import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Slots: Pagination & Sorting Integration Tests", () => {
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

  test("Should handle empty result list when no slots exist", async () => {
    const res = await request(app)
      .get("/api/slots")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  test("Should return slots sorted by startTime ascending", async () => {
    // Create slots with out-of-order timings
    const now = Date.now();
    const slotLater = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(now + 5 * 60 * 60 * 1000),
      endTime: new Date(now + 6 * 60 * 60 * 1000),
      capacity: 5,
    });

    const slotEarlier = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(now + 1 * 60 * 60 * 1000),
      endTime: new Date(now + 2 * 60 * 60 * 1000),
      capacity: 5,
    });

    const res = await request(app)
      .get("/api/slots")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    // Verify early slot comes first (startTime ascending sort)
    expect(res.body.data[0].id).toBe(slotEarlier._id.toString());
    expect(res.body.data[1].id).toBe(slotLater._id.toString());
  });

  test("Query parameters should not crash slot listings and can be parsed", async () => {
    const res = await request(app)
      .get("/api/slots?page=1&limit=10")
      .set("Authorization", `Bearer ${tokenStudent}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
