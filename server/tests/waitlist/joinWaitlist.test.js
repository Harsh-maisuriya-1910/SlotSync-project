import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import Waitlist from "../../src/modules/waitlist/waitlist.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import SLOT_STATUS from "../../src/constants/slotStatus.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import WAITLIST_STATUS from "../../src/constants/waitlistStatus.js";
import bookingRepository from "../../src/modules/bookings/booking.repository.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Waitlist System Integration & Concurrency Tests", () => {
  let counsellor, student1, student2, student3, admin;
  let tokenCounsellor, tokenStudent1, tokenStudent2, tokenStudent3, tokenAdmin;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
    await Slot.createIndexes();
    await Booking.createIndexes();
    await Waitlist.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create users
    counsellor = await User.create({
      name: "Counsellor",
      email: "counsellor@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student1 = await User.create({
      name: "Student 1",
      email: "student1@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    student2 = await User.create({
      name: "Student 2",
      email: "student2@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    student3 = await User.create({
      name: "Student 3",
      email: "student3@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    admin = await User.create({
      name: "Admin",
      email: "admin@test.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });

    tokenCounsellor = generateAccessToken({
      id: counsellor._id,
      role: counsellor.role,
    });
    tokenStudent1 = generateAccessToken({
      id: student1._id,
      role: student1.role,
    });
    tokenStudent2 = generateAccessToken({
      id: student2._id,
      role: student2.role,
    });
    tokenStudent3 = generateAccessToken({
      id: student3._id,
      role: student3.role,
    });
    tokenAdmin = generateAccessToken({ id: admin._id, role: admin.role });
  });

  test("Should not join waitlist if slot is not full", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SLOT_NOT_FULL");
  });

  test("Should join waitlist when slot is full", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    const res = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(WAITLIST_STATUS.WAITING);
    expect(res.body.data.queuePosition).toBe(1);

    const dbEntry = await Waitlist.findOne({ student: student1._id, slot: slot._id });
    expect(dbEntry).toBeDefined();
    expect(dbEntry.status).toBe(WAITLIST_STATUS.WAITING);
  });

  test("Should prevent student from waitlisting twice on same slot", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    // Join first time
    await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    // Join second time
    const res = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_WAITLISTED");
  });

  test("Should prevent student from waitlisting if already has booking", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    await Booking.create({
      student: student1._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const res = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("BOOKING_ALREADY_EXISTS");
  });

  test("FIFO ordering: Should assign incrementing queue positions", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    // Student 1 joins -> Pos 1
    const res1 = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });
    expect(res1.body.data.queuePosition).toBe(1);

    // Student 2 joins -> Pos 2
    const res2 = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent2}`)
      .send({ slotId: slot._id });
    expect(res2.body.data.queuePosition).toBe(2);

    // Student 3 joins -> Pos 3
    const res3 = await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent3}`)
      .send({ slotId: slot._id });
    expect(res3.body.data.queuePosition).toBe(3);
  });

  test("Booking cancellation triggers waitlist promotion in FIFO order", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    // Student 1 has the booking
    const booking = await Booking.create({
      student: student1._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    // Student 2 waitlists (Pos 1)
    await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent2}`)
      .send({ slotId: slot._id });

    // Student 3 waitlists (Pos 2)
    await request(app)
      .post("/api/waitlist")
      .set("Authorization", `Bearer ${tokenStudent3}`)
      .send({ slotId: slot._id });

    // Student 1 cancels booking
    const cancelRes = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(cancelRes.status).toBe(200);

    // Verify Student 2 (first in queue) promoted
    const waitlistEntry2 = await Waitlist.findOne({ student: student2._id, slot: slot._id });
    expect(waitlistEntry2.status).toBe(WAITLIST_STATUS.PROMOTED);
    expect(waitlistEntry2.promotedAt).toBeDefined();

    // Verify Student 3 is still waiting
    const waitlistEntry3 = await Waitlist.findOne({ student: student3._id, slot: slot._id });
    expect(waitlistEntry3.status).toBe(WAITLIST_STATUS.WAITING);

    // Verify a booking document was created for Student 2
    const promotedBooking = await Booking.findOne({ student: student2._id, slot: slot._id });
    expect(promotedBooking).toBeDefined();
    expect(promotedBooking.status).toBe(BOOKING_STATUS.BOOKED);

    // Verify Slot bookedCount remains 1 (not released)
    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(1);
  });

  test("Rollback behavior: promotion failure aborts transaction and rolls back waitlist state", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    const booking = await Booking.create({
      student: student1._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    await Waitlist.create({
      student: student2._id,
      slot: slot._id,
      status: WAITLIST_STATUS.WAITING,
      queuePosition: 1,
    });

    // Mock booking creation to fail
    const originalCreate = bookingRepository.createBookingWithSession;
    bookingRepository.createBookingWithSession = jest.fn().mockImplementation(() => {
      throw new Error("Simulated database promotion save failure");
    });

    // Attempt cancellation
    const cancelRes = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(cancelRes.status).toBe(500);

    // Restore mock
    bookingRepository.createBookingWithSession = originalCreate;

    // Verify rollback: Booking still active, slot stays at 1, student 2 still WAITING
    const activeBooking = await Booking.findById(booking._id);
    expect(activeBooking.status).toBe(BOOKING_STATUS.BOOKED);

    const waitlistEntry = await Waitlist.findOne({ student: student2._id, slot: slot._id });
    expect(waitlistEntry.status).toBe(WAITLIST_STATUS.WAITING);

    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(1);
  });

  test("View My Waitlist endpoint returns correct entries with populated slot counsellor", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    await Waitlist.create({
      student: student1._id,
      slot: slot._id,
      status: WAITLIST_STATUS.WAITING,
      queuePosition: 1,
    });

    const res = await request(app)
      .get("/api/waitlist/my-waitlist")
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].queuePosition).toBe(1);
    expect(res.body.data[0].slot.counsellor.email).toBe(counsellor.email);
  });

  test("Duplicate Join Race: 50 concurrent join attempts by same student only yields 1 waitlist entry", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    // Make 50 concurrent join requests
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        request(app)
          .post("/api/waitlist")
          .set("Authorization", `Bearer ${tokenStudent1}`)
          .send({ slotId: slot._id })
      );
    }

    const results = await Promise.all(promises);

    // Count how many succeeded (status 201) vs failed (status 409 or 500)
    const successCount = results.filter((r) => r.status === 201).length;
    const failureCount = results.filter((r) => r.status === 409 || r.status === 500).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(49);

    const dbEntries = await Waitlist.find({ slot: slot._id, student: student1._id });
    expect(dbEntries.length).toBe(1);
  });

  test("Promotion Race: concurrent cancellations promote waitlisted students correctly in FIFO order without duplicates", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 2,
      bookedCount: 2,
      status: SLOT_STATUS.FULL,
    });

    const booking1 = await Booking.create({
      student: student1._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const booking2 = await Booking.create({
      student: student2._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    // Create 2 waitlisted students
    const student4 = await User.create({
      name: "Student 4",
      email: "student4@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });
    const tokenStudent4 = generateAccessToken({ id: student4._id, role: student4.role });

    const waitlistEntry1 = await Waitlist.create({
      student: student3._id,
      slot: slot._id,
      status: WAITLIST_STATUS.WAITING,
      queuePosition: 1,
    });

    const waitlistEntry2 = await Waitlist.create({
      student: student4._id,
      slot: slot._id,
      status: WAITLIST_STATUS.WAITING,
      queuePosition: 2,
    });

    // Trigger concurrent cancellations by Student 1 and Student 2 with a 100ms offset to prevent Mongo memory lock collisions on the waitlist FIFO query
    const res1 = await request(app)
      .patch(`/api/bookings/${booking1._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const res2 = await request(app)
      .patch(`/api/bookings/${booking2._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent2}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verify both waitlisted students promoted
    const entry1 = await Waitlist.findById(waitlistEntry1._id);
    const entry2 = await Waitlist.findById(waitlistEntry2._id);
    expect(entry1.status).toBe(WAITLIST_STATUS.PROMOTED);
    expect(entry2.status).toBe(WAITLIST_STATUS.PROMOTED);

    // Verify bookings created for student3 and student4
    const newBooking3 = await Booking.findOne({ student: student3._id, slot: slot._id });
    const newBooking4 = await Booking.findOne({ student: student4._id, slot: slot._id });
    expect(newBooking3).toBeDefined();
    expect(newBooking4).toBeDefined();
    expect(newBooking3.status).toBe(BOOKING_STATUS.BOOKED);
    expect(newBooking4.status).toBe(BOOKING_STATUS.BOOKED);

    // Slot bookedCount remains 2 (both seats taken by promoted students)
    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(2);
  });
});
