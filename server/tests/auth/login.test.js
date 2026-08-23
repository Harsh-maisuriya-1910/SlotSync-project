import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Auth: Login Integration Tests", () => {
  let registerPayload;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    registerPayload = {
      name: "John Doe",
      email: "john@example.com",
      password: "Password123!",
    };

    // Pre-register user for login tests
    await request(app).post("/api/auth/register").send(registerPayload);
  });

  test("Login success and JWT return structure", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: registerPayload.email,
        password: registerPayload.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(registerPayload.email.toLowerCase());
  });

  test("Should fail login with wrong email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "wrong@example.com",
        password: registerPayload.password,
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  test("Should fail login with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: registerPayload.email,
        password: "WrongPassword!",
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  test("Should fail login when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        password: registerPayload.password,
      });

    expect(res.status).toBe(422);
  });

  test("Should fail login when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: registerPayload.email,
      });

    expect(res.status).toBe(422);
  });
});
