import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import SLOT_STATUS from "../../src/constants/slotStatus.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Bookings: Booking Overlap Protection Tests", () => {
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

  test("Should reject booking if student has an overlapping active booking", async () => {
    const startTime1 = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime1 = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const slot1 = await Slot.create({
      counsellor: counsellor._id,
      startTime: startTime1,
      endTime: endTime1,
      capacity: 5,
      bookedCount: 1,
      status: SLOT_STATUS.AVAILABLE,
    });

    // Student already booked slot1
    await Booking.create({
      student: student._id,
      slot: slot1._id,
      status: BOOKING_STATUS.BOOKED,
    });

    // Create slot2 that overlaps with slot1
    const startTime2 = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const endTime2 = new Date(Date.now() + 5 * 60 * 60 * 1000);

    const slot2 = await Slot.create({
      counsellor: counsellor._id,
      startTime: startTime2,
      endTime: endTime2,
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    // Book slot2 (should fail due to overlap with slot1 booking)
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot2._id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("OVERLAPPING_BOOKING");
  });

  test("Should succeed booking when there is no schedule overlap", async () => {
    const startTime1 = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime1 = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const slot1 = await Slot.create({
      counsellor: counsellor._id,
      startTime: startTime1,
      endTime: endTime1,
      capacity: 5,
      bookedCount: 1,
      status: SLOT_STATUS.AVAILABLE,
    });

    await Booking.create({
      student: student._id,
      slot: slot1._id,
      status: BOOKING_STATUS.BOOKED,
    });

    // Create slot2 that is after slot1 (no overlap)
    const startTime2 = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const endTime2 = new Date(Date.now() + 5 * 60 * 60 * 1000);

    const slot2 = await Slot.create({
      counsellor: counsellor._id,
      startTime: startTime2,
      endTime: endTime2,
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot2._id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
