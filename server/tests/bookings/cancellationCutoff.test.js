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

describe("Bookings: Booking Cancellation Cutoff & Status Tests", () => {
  let counsellor, student, tokenStudent;

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

    counsellor = await User.create({
      name: "Counsellor",
      email: "counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student = await User.create({
      name: "Student",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
  });

  test("Cancel success when slot starts in > 2 hours", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // starts in 3 hours
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
    });

    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(BOOKING_STATUS.CANCELLED);
  });

  test("Cancel fails with 422 when slot starts inside 2-hour cutoff window", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 90 * 60 * 1000), // starts in 90 minutes (< 2 hours)
      endTime: new Date(Date.now() + 150 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
    });

    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CANCELLATION_WINDOW_CLOSED");
  });

  test("Cancel success boundary at exactly 120 minutes from now", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 120 * 60 * 1000 + 5000), // exactly 120 mins + 5s padding for execution delay
      endTime: new Date(Date.now() + 180 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
    });

    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("Cannot cancel booking that is already cancelled", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
    });

    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.CANCELLED,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("BOOKING_ALREADY_CANCELLED");
  });
});
