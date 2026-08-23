import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import SLOT_STATUS from "../../src/constants/slotStatus.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Bookings: Booking Window Constraints Tests", () => {
  let counsellor, student, tokenStudent;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
    await Slot.createIndexes();
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

  test("Should fail booking when slot starts within 30 minutes (forbidden window)", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 15 * 60 * 1000), // starts in 15 minutes
      endTime: new Date(Date.now() + 75 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("BOOKING_WINDOW_CLOSED");
  });

  test("Should succeed booking when slot starts in more than 30 minutes", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 45 * 60 * 1000), // starts in 45 minutes
      endTime: new Date(Date.now() + 105 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
