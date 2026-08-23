import request from "supertest";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import IdempotencyRecord from "../../src/modules/bookings/idempotencyRecord.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Bookings: Idempotency-Key Integration Tests", () => {
  let counsellor, student, otherStudent, tokenStudent, tokenOther;

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

    student = await User.create({
      name: "Student",
      email: "student@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    otherStudent = await User.create({
      name: "Other Student",
      email: "other@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    tokenStudent = generateAccessToken({ id: student._id, role: student.role });
    tokenOther = generateAccessToken({
      id: otherStudent._id,
      role: otherStudent.role,
    });
  });

  const createSlot = async () => {
    return await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
    });
  };

  test("duplicate POST with the same Idempotency-Key returns the identical result", async () => {
    const slot = await createSlot();

    const payload = { slotId: slot._id.toString() };
    const headers = { "Idempotency-Key": "retry-safe-key-001" };

    const first = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .set(headers)
      .send(payload);

    const second = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .set(headers)
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data).toEqual(first.body.data);

    // Exactly one booking exists; the retry did not double-book
    const bookings = await Booking.countDocuments({
      student: student._id,
      slot: slot._id,
    });
    expect(bookings).toBe(1);

    // The retry did not consume another seat
    const freshSlot = await Slot.findById(slot._id);
    expect(freshSlot.bookedCount).toBe(1);
  });

  test("different keys on the same slot still hit the duplicate guard", async () => {
    const slot = await createSlot();

    const first = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .set("Idempotency-Key", "key-a")
      .send({ slotId: slot._id.toString() });

    const second = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .set("Idempotency-Key", "key-b")
      .send({ slotId: slot._id.toString() });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("BOOKING_ALREADY_EXISTS");
  });

  test("the same key is scoped per student", async () => {
    const slotA = await createSlot();
    const slotB = await createSlot();

    const mine = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .set("Idempotency-Key", "shared-key")
      .send({ slotId: slotA._id.toString() });

    const theirs = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenOther}`)
      .set("Idempotency-Key", "shared-key")
      .send({ slotId: slotB._id.toString() });

    expect(mine.status).toBe(201);
    expect(theirs.status).toBe(201);
    expect(theirs.body.data.id).not.toBe(mine.body.data.id);

    const records = await IdempotencyRecord.countDocuments({
      key: "shared-key",
    });
    expect(records).toBe(2);
  });

  test("requests without an Idempotency-Key behave exactly as before", async () => {
    const slot = await createSlot();

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ slotId: slot._id.toString() });

    expect(res.status).toBe(201);

    const records = await IdempotencyRecord.countDocuments({});
    expect(records).toBe(0);
  });
});
