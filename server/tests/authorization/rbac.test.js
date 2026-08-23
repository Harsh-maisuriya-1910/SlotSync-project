import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Role-Based Access Control (RBAC) Verification", () => {
  let adminToken, counsellorToken, studentToken;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    const admin = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });

    const counsellor = await User.create({
      name: "Counsellor User",
      email: "counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const student = await User.create({
      name: "Student User",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    adminToken = generateAccessToken({ id: admin._id, role: admin.role });
    counsellorToken = generateAccessToken({
      id: counsellor._id,
      role: counsellor.role,
    });
    studentToken = generateAccessToken({ id: student._id, role: student.role });
  });

  test("Only Admins can register new counsellors", async () => {
    const payload = {
      name: "New Counsellor",
      email: "new_c@test.com",
      password: "Password123!",
    };

    // Admin should succeed (201)
    const adminRes = await request(app)
      .post("/api/users/counsellors")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);
    expect(adminRes.status).toBe(201);

    // Counsellor should be forbidden (403)
    const counsellorRes = await request(app)
      .post("/api/users/counsellors")
      .set("Authorization", `Bearer ${counsellorToken}`)
      .send(payload);
    expect(counsellorRes.status).toBe(403);

    // Student should be forbidden (403)
    const studentRes = await request(app)
      .post("/api/users/counsellors")
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);
    expect(studentRes.status).toBe(403);
  });

  test("Only Counsellors can view own slots, own bookings, and mark outcome", async () => {
    const fakeBookingId = new mongoose.Types.ObjectId().toString();

    // Counsellor should succeed (200) or find no results but not be forbidden
    const counsellorResSlots = await request(app)
      .get("/api/counsellor/slots")
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorResSlots.status).toBe(200);

    const counsellorResBookings = await request(app)
      .get("/api/counsellor/bookings")
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorResBookings.status).toBe(200);

    const counsellorResDashboard = await request(app)
      .get("/api/counsellor/dashboard")
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorResDashboard.status).toBe(200);

    // Admin should be forbidden (403)
    const adminResSlots = await request(app)
      .get("/api/counsellor/slots")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminResSlots.status).toBe(403);

    const adminResBookings = await request(app)
      .get("/api/counsellor/bookings")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminResBookings.status).toBe(403);

    const adminResOutcome = await request(app)
      .patch(`/api/counsellor/bookings/${fakeBookingId}/outcome`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ATTENDED" });
    expect(adminResOutcome.status).toBe(403);

    // Student should be forbidden (403)
    const studentResSlots = await request(app)
      .get("/api/counsellor/slots")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentResSlots.status).toBe(403);

    const studentResBookings = await request(app)
      .get("/api/counsellor/bookings")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentResBookings.status).toBe(403);

    const studentResOutcome = await request(app)
      .patch(`/api/counsellor/bookings/${fakeBookingId}/outcome`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ status: "ATTENDED" });
    expect(studentResOutcome.status).toBe(403);
  });

  test("Only Students can create bookings, cancel bookings, and get own bookings", async () => {
    const fakeBookingId = new mongoose.Types.ObjectId().toString();
    const fakeSlotId = new mongoose.Types.ObjectId().toString();

    // Student is allowed to call booking endpoints (not 403, might be 404 or 409 depending on ids but not 403)
    const studentResCreate = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ slotId: fakeSlotId });
    expect(studentResCreate.status).not.toBe(403);

    const studentResCancel = await request(app)
      .patch(`/api/bookings/${fakeBookingId}/cancel`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentResCancel.status).not.toBe(403);

    const studentResGet = await request(app)
      .get("/api/bookings/my-bookings")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentResGet.status).toBe(200);

    // Counsellor is forbidden (403)
    const counsellorResCreate = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${counsellorToken}`)
      .send({ slotId: fakeSlotId });
    expect(counsellorResCreate.status).toBe(403);

    const counsellorResCancel = await request(app)
      .patch(`/api/bookings/${fakeBookingId}/cancel`)
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorResCancel.status).toBe(403);

    const counsellorResGet = await request(app)
      .get("/api/bookings/my-bookings")
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorResGet.status).toBe(403);
  });
});
