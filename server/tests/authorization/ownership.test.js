import request from "supertest";
import mongoose from "mongoose";
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

describe("Counsellor Ownership & Outcome Transition Verification", () => {
  let counsellorA, counsellorB, student;
  let tokenA, tokenB;
  let slotA, slotB;
  let bookingA, bookingB;

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

    // 1. Create Counsellors
    counsellorA = await User.create({
      name: "Counsellor A",
      email: "counsellor_a@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });
    counsellorB = await User.create({
      name: "Counsellor B",
      email: "counsellor_b@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    tokenA = generateAccessToken({
      id: counsellorA._id,
      role: counsellorA.role,
    });
    tokenB = generateAccessToken({
      id: counsellorB._id,
      role: counsellorB.role,
    });

    // 2. Create Student
    student = await User.create({
      name: "Student",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    // 3. Create Slots
    slotA = await Slot.create({
      counsellor: counsellorA._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
      status: SLOT_STATUS.AVAILABLE,
    });
    slotB = await Slot.create({
      counsellor: counsellorB._id,
      startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
      status: SLOT_STATUS.AVAILABLE,
    });

    // 4. Create Bookings
    bookingA = await Booking.create({
      student: student._id,
      slot: slotA._id,
      status: BOOKING_STATUS.BOOKED,
    });
    bookingB = await Booking.create({
      student: student._id,
      slot: slotB._id,
      status: BOOKING_STATUS.BOOKED,
    });
  });

  test("Counsellor should only see their own slots", async () => {
    const res = await request(app)
      .get("/api/counsellor/slots")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(slotA._id.toString());
  });

  test("Counsellor should only see bookings for their own slots", async () => {
    const res = await request(app)
      .get("/api/counsellor/bookings")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(bookingA._id.toString());
    expect(res.body.data[0].student.email).toBe(student.email);
    expect(res.body.data[0].slot.id).toBe(slotA._id.toString());
  });

  test("Counsellor cannot mark outcome of another counsellor's booking", async () => {
    const res = await request(app)
      .patch(`/api/counsellor/bookings/${bookingB._id}/outcome`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "ATTENDED" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("Counsellor can mark outcome of their own booking and it updates successfully", async () => {
    const res = await request(app)
      .patch(`/api/counsellor/bookings/${bookingA._id}/outcome`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "ATTENDED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(BOOKING_STATUS.ATTENDED);

    const updatedBooking = await Booking.findById(bookingA._id);
    expect(updatedBooking.status).toBe(BOOKING_STATUS.ATTENDED);
  });

  test("Cannot mark outcome of cancelled bookings", async () => {
    // Cancel the booking first
    bookingA.status = BOOKING_STATUS.CANCELLED;
    await bookingA.save();

    const res = await request(app)
      .patch(`/api/counsellor/bookings/${bookingA._id}/outcome`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "ATTENDED" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("Cannot update outcome of already completed (attended/no_show) bookings", async () => {
    // Mark as attended first
    bookingA.status = BOOKING_STATUS.ATTENDED;
    await bookingA.save();

    const res = await request(app)
      .patch(`/api/counsellor/bookings/${bookingA._id}/outcome`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "NO_SHOW" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("Validation should reject invalid outcomes", async () => {
    const res = await request(app)
      .patch(`/api/counsellor/bookings/${bookingA._id}/outcome`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "CANCELLED" }); // CANCELLED is not allowed outcome from counsellor

    expect(res.status).toBe(422);
  });
});
