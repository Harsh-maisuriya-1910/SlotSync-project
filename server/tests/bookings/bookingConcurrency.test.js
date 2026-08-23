import request from "supertest";
import mongoose from "mongoose";
import { jest } from "@jest/globals";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import bookingRepository from "../../src/modules/bookings/booking.repository.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";

// Set a long timeout for the concurrency tests since they run multiple parallel transactions in-memory
jest.setTimeout(30000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to handle transient write conflict errors (code 112) typical in concurrent MongoDB transactions
async function bookSlotWithRetry(token, slotId, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ slotId });

    const isTransientError =
      res.status === 500 &&
      (res.body.code === 112 ||
        res.body.code === "WriteConflict" ||
        (res.body.message &&
          (res.body.message.includes("Write conflict") ||
            res.body.message.includes("transaction") ||
            res.body.message.includes("TransientTransactionError"))));

    if (isTransientError) {
      // Random backoff delay between 20ms and 150ms to resolve write lock conflicts
      const delay = Math.floor(Math.random() * 130) + 20;
      await sleep(delay);
      continue;
    }

    return res;
  }
  throw new Error(`Max retries exceeded for token: ${token}`);
}

describe("Booking Concurrency & Stress Tests", () => {
  beforeAll(async () => {
    await connect();
    // Ensure all model indexes are created (especially the unique index on Booking)
    await User.createIndexes();
    await Slot.createIndexes();
    await Booking.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test("Scenario 1: Capacity = 5, 20 concurrent booking requests from 20 different students", async () => {
    const counsellor = await User.create({
      name: "Counsellor 1",
      email: "counsellor1@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime,
      endTime,
      capacity: 5,
      bookedCount: 0,
    });

    const tokens = [];
    for (let i = 1; i <= 20; i++) {
      const student = await User.create({
        name: `Student ${i}`,
        email: `student${i}@test.com`,
        password: "Password123!",
        role: ROLES.STUDENT,
      });

      const token = generateAccessToken({
        id: student._id,
        role: student.role,
      });
      tokens.push(token);
    }

    // Execute requests concurrently
    const requests = tokens.map((token) =>
      bookSlotWithRetry(token, slot._id.toString())
    );

    const responses = await Promise.all(requests);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    responses.forEach((res) => {
      if (res.status === 201) {
        successCount++;
      } else {
        failCount++;
        errors.push(res.body);
      }
    });

    expect(successCount).toBe(5);
    expect(failCount).toBe(15);

    errors.forEach((err) => {
      expect(err.success).toBe(false);
      expect(err.message).toBe("Slot is full");
      expect(err.code).toBe("SLOT_FULL");
    });

    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(5);

    const bookingCount = await Booking.countDocuments({ slot: slot._id });
    expect(bookingCount).toBe(5);
  });

  test("Scenario 2: Capacity = 1, 10 concurrent requests from 10 different students", async () => {
    const counsellor = await User.create({
      name: "Counsellor 2",
      email: "counsellor2@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime,
      endTime,
      capacity: 1,
      bookedCount: 0,
    });

    const tokens = [];
    for (let i = 1; i <= 10; i++) {
      const student = await User.create({
        name: `Student ${i}`,
        email: `student_scenario2_${i}@test.com`,
        password: "Password123!",
        role: ROLES.STUDENT,
      });

      const token = generateAccessToken({
        id: student._id,
        role: student.role,
      });
      tokens.push(token);
    }

    const requests = tokens.map((token) =>
      bookSlotWithRetry(token, slot._id.toString())
    );

    const responses = await Promise.all(requests);

    let successCount = 0;
    let failCount = 0;

    responses.forEach((res) => {
      if (res.status === 201) {
        successCount++;
      } else {
        failCount++;
        expect(res.body.code).toBe("SLOT_FULL");
      }
    });

    expect(successCount).toBe(1);
    expect(failCount).toBe(9);

    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(1);

    const bookingCount = await Booking.countDocuments({ slot: slot._id });
    expect(bookingCount).toBe(1);
  });

  test("Scenario 3: Capacity = 5, 10 concurrent requests from the same student (duplicate protection)", async () => {
    const counsellor = await User.create({
      name: "Counsellor 3",
      email: "counsellor3@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime,
      endTime,
      capacity: 5,
      bookedCount: 0,
    });

    const student = await User.create({
      name: "Student Scenario 3",
      email: "student_scenario3@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    const token = generateAccessToken({
      id: student._id,
      role: student.role,
    });

    const requests = Array.from({ length: 10 }).map(() =>
      bookSlotWithRetry(token, slot._id.toString())
    );

    const responses = await Promise.all(requests);

    let successCount = 0;
    let failCount = 0;

    responses.forEach((res) => {
      if (res.status === 201) {
        successCount++;
      } else {
        failCount++;
        expect(["BOOKING_ALREADY_EXISTS", "DUPLICATE_RESOURCE"]).toContain(
          res.body.code
        );
      }
    });

    expect(successCount).toBe(1);
    expect(failCount).toBe(9);

    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(1);

    const bookingCount = await Booking.countDocuments({ slot: slot._id });
    expect(bookingCount).toBe(1);
  });

  test("Scenario 4: Booking transaction rollback - failure after seat reservation", async () => {
    const counsellor = await User.create({
      name: "Counsellor 4",
      email: "counsellor4@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime,
      endTime,
      capacity: 5,
      bookedCount: 0,
    });

    const student = await User.create({
      name: "Student Scenario 4",
      email: "student_scenario4@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    const token = generateAccessToken({
      id: student._id,
      role: student.role,
    });

    // Mock createBookingWithSession to throw an error after seat reservation
    const spy = jest
      .spyOn(bookingRepository, "createBookingWithSession")
      .mockRejectedValueOnce(
        new Error("Database failure during booking creation after seat reservation")
      );

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ slotId: slot._id.toString() });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_SERVER_ERROR");

    // Verify slot bookedCount was rolled back (remains 0)
    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(0);

    // Verify no booking was created
    const bookingCount = await Booking.countDocuments({ slot: slot._id });
    expect(bookingCount).toBe(0);

    spy.mockRestore();
  });
});
