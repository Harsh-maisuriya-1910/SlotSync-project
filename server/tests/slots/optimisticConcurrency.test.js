import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Slots: Optimistic Concurrency Integration Tests", () => {
  let counsellor, owner, student, tokenOwner, tokenOther, tokenStudent;

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

    owner = counsellor;

    const otherCounsellor = await User.create({
      name: "Other Counsellor",
      email: "other.counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student = await User.create({
      name: "Student",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenOwner = generateAccessToken({ id: owner._id, role: owner.role });
    tokenOther = generateAccessToken({
      id: otherCounsellor._id,
      role: otherCounsellor.role,
    });
    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
  });

  const createSlot = async () => {
    return await Slot.create({
      counsellor: owner._id,
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 49 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
    });
  };

  test("update with matching version succeeds and bumps the version", async () => {
    const slot = await createSlot();
    expect(slot.version).toBe(0);

    const res = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ expectedVersion: 0, capacity: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.capacity).toBe(10);
    expect(res.body.data.version).toBe(1);
  });

  test("update with a stale version returns 409 SLOT_VERSION_CONFLICT", async () => {
    const slot = await createSlot();

    const first = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ expectedVersion: 0, capacity: 8 });

    expect(first.status).toBe(200);

    // Second client still holds the pre-update snapshot
    const second = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ expectedVersion: 0, capacity: 20 });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("SLOT_VERSION_CONFLICT");
    expect(second.body.success).toBe(false);

    // Winner's data is intact
    const fresh = await Slot.findById(slot._id);
    expect(fresh.capacity).toBe(8);
    expect(fresh.version).toBe(1);
  });

  test("seat reservations also increment the version (all mutations guarded)", async () => {
    const slot = await createSlot();

    // Real booking flow: reserveSeat() increments bookedCount AND version
    const booking = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot._id.toString() });

    expect(booking.status).toBe(201);

    const fresh = await Slot.findById(slot._id);
    expect(fresh.bookedCount).toBe(1);
    expect(fresh.version).toBe(1);

    // A client holding the original version-0 snapshot now conflicts
    const res = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ expectedVersion: 0, capacity: 50 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SLOT_VERSION_CONFLICT");
  });

  test("non-owner counsellor cannot update someone else's slot", async () => {
    const slot = await createSlot();

    const res = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOther}`)
      .send({ expectedVersion: 0, capacity: 99 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCESS_FORBIDDEN");
  });

  test("missing expectedVersion is rejected as a validation error", async () => {
    const slot = await createSlot();

    const res = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ capacity: 12 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test("unknown slot id returns 404", async () => {
    const mongoose = await import("mongoose");
    const fakeId = new mongoose.default.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/slots/${fakeId}`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ expectedVersion: 0, capacity: 5 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SLOT_NOT_FOUND");
  });

  test("students cannot call the update endpoint", async () => {
    const slot = await createSlot();

    const res = await request(app)
      .patch(`/api/slots/${slot._id}`)
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ expectedVersion: 0, capacity: 3 });

    expect(res.status).toBe(403);
  });
});
