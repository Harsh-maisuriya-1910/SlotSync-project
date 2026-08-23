import request from "supertest";
import mongoose from "mongoose";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

// Re-enable the login rate limiter for this suite only, with a tiny budget so
// the limit is reachable quickly. Must be set BEFORE importing the app.
process.env.NODE_ENV = "test";
process.env.ENABLE_RATE_LIMIT_IN_TESTS = "true";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX = "3";

describe("Security Hardening Integration Tests", () => {
  let app;
  let admin, counsellor, student;
  let tokenAdmin, tokenCounsellor, tokenStudent;

  beforeAll(async () => {
    ({ default: app } = await import("../../src/app.js"));

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

    admin = await User.create({
      name: "Admin",
      email: "admin@sectest.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });

    counsellor = await User.create({
      name: "Counsellor",
      email: "counsellor@sectest.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student = await User.create({
      name: "Student",
      email: "student@sectest.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenAdmin = generateAccessToken({ id: admin._id, role: admin.role });
    tokenCounsellor = generateAccessToken({
      id: counsellor._id,
      role: counsellor.role,
    });
    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
  });

  describe("Helmet security headers", () => {
    test("sets hardened headers on API responses", async () => {
      const res = await request(app).get("/");

      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
      expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
    });
  });

  describe("Strict CORS", () => {
    const allowedOrigin = "http://localhost:5173";
    const disallowedOrigin = "http://evil.example.com";

    test("allows allowlisted origin and reflects it", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", allowedOrigin);

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(allowedOrigin);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("withholds CORS headers from disallowed origins", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", disallowedOrigin);

      expect(res.status).toBe(200); // non-browser clients still reach the API
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    test("preflight from disallowed origin carries no allow-origin header", async () => {
      const res = await request(app)
        .options("/api/auth/login")
        .set("Origin", disallowedOrigin)
        .set("Access-Control-Request-Method", "POST");

      expect(
        res.headers["access-control-allow-origin"],
      ).toBeUndefined();
    });

    test("preflight from allowed origin exposes permitted methods", async () => {
      const res = await request(app)
        .options("/api/auth/login")
        .set("Origin", allowedOrigin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-methods"]).toContain("POST");
      expect(res.headers["access-control-allow-origin"]).toBe(allowedOrigin);
    });
  });

  describe("Login rate limiting", () => {
    test("returns 429 RATE_LIMIT_EXCEEDED once the attempt budget is exhausted", async () => {
      const payload = {
        email: "bruteforce@sectest.com",
        password: "WrongPassword123!",
      };

      // RATE_LIMIT_MAX=3: first three attempts pass through to auth logic (401)
      for (let i = 0; i < 3; i += 1) {
        const res = await request(app)
          .post("/api/auth/login")
          .send(payload);

        expect(res.status).toBe(401);
      }

      // Fourth attempt is throttled
      const blocked = await request(app)
        .post("/api/auth/login")
        .send(payload);

      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blocked.headers["ratelimit-limit"]).toBe("3");
      expect(blocked.headers["ratelimit-remaining"]).toBe("0");
    });
  });

  describe("Request body size limits", () => {
    test("rejects oversized JSON payloads with 413 REQUEST_ENTITY_TOO_LARGE", async () => {
      const bloatedDescription = "A".repeat(11 * 1024); // limit is 10kb

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Bloated Payload",
          email: "bloated@sectest.com",
          password: "Password123!",
          about: bloatedDescription,
        });

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("REQUEST_ENTITY_TOO_LARGE");
    });
  });

  describe("Centralized error mapping (401 / 403 / 409 / 422)", () => {
    const expectConsistentEnvelope = (res) => {
      expect(typeof res.body.success).toBe("boolean");
      expect(res.body.success).toBe(false);
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(typeof res.body.code).toBe("string");
      expect(res.body.code.length).toBeGreaterThan(0);
    };

    test("401 UNAUTHENTICATED when no token is provided", async () => {
      const res = await request(app).get("/api/bookings/my-bookings");

      expect(res.status).toBe(401);
      expectConsistentEnvelope(res);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    });

    test("403 ACCESS_FORBIDDEN when role is insufficient", async () => {
      const res = await request(app)
        .get("/api/analytics/admin")
        .set("Authorization", `Bearer ${tokenStudent}`);

      expect(res.status).toBe(403);
      expectConsistentEnvelope(res);
      expect(res.body.code).toBe("ACCESS_FORBIDDEN");
    });

    test("409 with domain code on duplicate booking conflict", async () => {
      const slot = await Slot.create({
        counsellor: counsellor._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        capacity: 5,
        bookedCount: 1,
      });

      await Booking.create({
        student: student._id,
        slot: slot._id,
        status: BOOKING_STATUS.BOOKED,
      });

      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${tokenStudent}`)
        .send({ slotId: slot._id });

      expect(res.status).toBe(409);
      expectConsistentEnvelope(res);
      expect(res.body.code).toBe("BOOKING_ALREADY_EXISTS");
    });

    test("422 INVALID_STATUS_TRANSITION on illegal booking transition", async () => {
      const slot = await Slot.create({
        counsellor: counsellor._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        capacity: 5,
        bookedCount: 1,
      });

      const booking = await Booking.create({
        student: student._id,
        slot: slot._id,
        status: BOOKING_STATUS.CANCELLED,
      });

      const res = await request(app)
        .patch(`/api/counsellor/bookings/${booking._id}/outcome`)
        .set("Authorization", `Bearer ${tokenCounsellor}`)
        .send({ status: BOOKING_STATUS.ATTENDED });

      expect(res.status).toBe(422);
      expectConsistentEnvelope(res);
      expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });
});
