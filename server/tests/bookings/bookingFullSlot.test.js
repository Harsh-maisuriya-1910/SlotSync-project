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

describe("Bookings: Booking Full Slot Rejection Tests", () => {
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

  test("Should reject booking when slot is full (capacity met)", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1, // Full slot
      status: SLOT_STATUS.FULL,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SLOT_FULL");
  });
});
