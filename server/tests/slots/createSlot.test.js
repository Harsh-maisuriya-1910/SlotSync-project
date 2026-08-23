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

describe("Slots: Create Slot Integration Tests", () => {
  let counsellor, student, tokenCounsellor, tokenStudent;

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
      name: "Counsellor User",
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

    tokenCounsellor = generateAccessToken({ id: counsellor._id, role: counsellor.role });
    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
  });

  test("Slot creation success and status mapping", async () => {
    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime,
        endTime,
        capacity: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(3);
    expect(res.body.data.status).toBe(SLOT_STATUS.AVAILABLE);
    expect(res.body.data.bookedCount).toBe(0);
  });

  test("Should restrict slot creation to Counsellors only", async () => {
    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({
        startTime,
        endTime,
        capacity: 3,
      });

    expect(res.status).toBe(403);
  });

  test("Should fail creation when capacity is invalid", async () => {
    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 3 * 60 * 60 * 1000);

    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime,
        endTime,
        capacity: 0, // Capacity must be >= 1
      });

    expect(res.status).toBe(422);
  });

  test("Should fail creation when end time is before start time", async () => {
    const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime,
        endTime,
        capacity: 3,
      });

    expect(res.status).toBe(422);
  });

  test("Should prevent creation of overlapping slots for same counsellor", async () => {
    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // Create first slot
    await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime,
        endTime,
        capacity: 3,
      });

    // Create overlapping slot (starts inside the first slot's duration)
    const overlappingStartTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const overlappingEndTime = new Date(Date.now() + 5 * 60 * 60 * 1000);

    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime: overlappingStartTime,
        endTime: overlappingEndTime,
        capacity: 2,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SLOT_OVERLAP");
  });
});
