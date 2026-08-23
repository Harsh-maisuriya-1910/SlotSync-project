import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Auth: Registration Integration Tests", () => {
  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test("Register success and correct response structure", async () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
    };

    const res = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.name).toBe(payload.name);
    expect(res.body.data.email).toBe(payload.email.toLowerCase());
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.password).toBeUndefined(); // Should not return password field
  });

  test("Password should be hashed in the database", async () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
    };

    await request(app)
      .post("/api/auth/register")
      .send(payload);

    const user = await User.findOne({ email: payload.email.toLowerCase() }).select("+password");
    expect(user).toBeDefined();
    expect(user.password).not.toBe(payload.password); // Verify hashed
    const matched = await user.comparePassword(payload.password);
    expect(matched).toBe(true);
  });

  test("Duplicate email should be rejected with 409", async () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
    };

    // Register first time
    await request(app).post("/api/auth/register").send(payload);

    // Register second time
    const res = await request(app).post("/api/auth/register").send(payload);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  test("Should reject registration with missing name", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "john@example.com",
        password: "Password123!",
      });

    expect(res.status).toBe(422);
  });

  test("Should reject registration with missing email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "John Doe",
        password: "Password123!",
      });

    expect(res.status).toBe(422);
  });

  test("Should reject registration with missing password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "John Doe",
        email: "john@example.com",
      });

    expect(res.status).toBe(422);
  });

  test("Should reject registration with invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "John Doe",
        email: "invalid-email-format",
        password: "Password123!",
      });

    expect(res.status).toBe(422);
  });
});
