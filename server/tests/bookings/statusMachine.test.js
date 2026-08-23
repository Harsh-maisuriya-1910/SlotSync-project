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

describe("Bookings: Status Machine Transitions Tests", () => {
  let counsellor, student, tokenCounsellor, tokenStudent;
  let slot;

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

    tokenCounsellor = generateAccessToken({ id: counsellor._id, role: counsellor.role });
    tokenStudent = generateAccessToken({ id: student._id, role: student.role });

    slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
    });
  });

  test("BOOKED -> CANCELLED is allowed (by student)", async () => {
    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(BOOKING_STATUS.CANCELLED);
  });

  test("BOOKED -> ATTENDED and BOOKED -> NO_SHOW are allowed (by counsellor)", async () => {
    const booking1 = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res1 = await request(app)
      .patch(`/api/counsellor/bookings/${booking1._id}/outcome`)
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({ status: BOOKING_STATUS.ATTENDED });

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe(BOOKING_STATUS.ATTENDED);

    const slot2 = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 1,
    });

    const booking2 = await Booking.create({
      student: student._id,
      slot: slot2._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res2 = await request(app)
      .patch(`/api/counsellor/bookings/${booking2._id}/outcome`)
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({ status: BOOKING_STATUS.NO_SHOW });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe(BOOKING_STATUS.NO_SHOW);
  });

  test("Reject CANCELLED -> ATTENDED/NO_SHOW", async () => {
    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.CANCELLED,
    });

    const res = await request(app)
      .patch(`/api/counsellor/bookings/${booking._id}/outcome`)
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({ status: BOOKING_STATUS.ATTENDED });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("Reject outcome transitions if already marked completed (ATTENDED -> NO_SHOW)", async () => {
    const booking = await Booking.create({
      student: student._id,
      slot: slot._id,
      status: BOOKING_STATUS.ATTENDED,
    });

    const res = await request(app)
      .patch(`/api/counsellor/bookings/${booking._id}/outcome`)
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({ status: BOOKING_STATUS.NO_SHOW });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
  });
});
