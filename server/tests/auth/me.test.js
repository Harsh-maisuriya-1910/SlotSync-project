import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Auth: Get Me Integration Tests", () => {
  let student, studentToken;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    student = await User.create({
      name: "Student User",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    studentToken = generateAccessToken({ id: student._id, role: student.role });
  });

  test("Should fail if token is missing", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("Should fail if token is invalid", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalidtoken123");
    expect(res.status).toBe(401);
  });

  test("Should return correct user payload with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(student.email.toLowerCase());
    expect(res.body.data.name).toBe(student.name);
    expect(res.body.data.role).toBe(student.role);
    expect(res.body.data.id).toBe(student._id.toString());
  });
});
