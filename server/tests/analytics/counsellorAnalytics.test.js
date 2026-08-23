import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Analytics: Counsellor Analytics Endpoint Tests", () => {
  let admin, counsellor, student;
  let tokenAdmin, tokenCounsellor, tokenStudent;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
    await Slot.createIndexes();
    await Booking.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    admin = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });

    counsellor = await User.create({
      name: "Staff Counsellor",
      email: "counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student = await User.create({
      name: "Student User",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenAdmin = generateAccessToken({ id: admin._id, role: admin.role });
    tokenCounsellor = generateAccessToken({ id: counsellor._id, role: counsellor.role });
    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
  });

  test("Deny access to Student role (403)", async () => {
    const res = await request(app)
      .get(`/api/analytics/counsellor/${counsellor._id}`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(403);
  });

  test("Deny access to Counsellor role (403)", async () => {
    const res = await request(app)
      .get(`/api/analytics/counsellor/${counsellor._id}`)
      .set("Authorization", `Bearer ${tokenCounsellor}`);

    expect(res.status).toBe(403);
  });

  test("Allow access to Admin role (200) and return correct facets format", async () => {
    // Seed slot
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // starts in 3 days (lead time > 48h)
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      capacity: 10,
      bookedCount: 1,
    });

    // Seed booking
    await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .get(`/api/analytics/counsellor/${counsellor._id}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stats = res.body.data;
    expect(stats).toHaveProperty("seatUtilization");
    expect(stats.seatUtilization.capacity).toBe(10);
    expect(stats.seatUtilization.bookedCount).toBe(1);
    expect(stats.seatUtilization.utilizationPercentage).toBe(10);

    expect(stats).toHaveProperty("bookingStatusDistribution");
    expect(stats.bookingStatusDistribution.BOOKED).toBe(1);
    expect(stats.bookingStatusDistribution.CANCELLED).toBe(0);

    expect(stats).toHaveProperty("busiestSlots");
    expect(stats.busiestSlots.length).toBeGreaterThan(0);
    expect(stats.busiestSlots[0]._id.toString()).toBe(slot._id.toString());

    expect(stats).toHaveProperty("leadTimeBuckets");
    const leadTimeBuckets = stats.leadTimeBuckets;
    expect(leadTimeBuckets.find(b => b.bucket === "48+ Hours").count).toBe(1);

    expect(stats).toHaveProperty("last14DaysTrend");
    expect(Array.isArray(stats.last14DaysTrend)).toBe(true);
  });
});
