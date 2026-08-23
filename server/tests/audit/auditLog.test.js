import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import Waitlist from "../../src/modules/waitlist/waitlist.model.js";
import Audit from "../../src/modules/audit/audit.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import SLOT_STATUS from "../../src/constants/slotStatus.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import WAITLIST_STATUS from "../../src/constants/waitlistStatus.js";
import AUDIT_ACTIONS from "../../src/constants/auditActions.js";
import bookingRepository from "../../src/modules/bookings/booking.repository.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Audit Logging System Integration Tests", () => {
  let counsellor, student1, student2, admin;
  let tokenCounsellor, tokenStudent1, tokenStudent2, tokenAdmin;

  beforeAll(async () => {
    await connect();
    await User.createIndexes();
    await Slot.createIndexes();
    await Booking.createIndexes();
    await Waitlist.createIndexes();
    await Audit.createIndexes();
  });

  afterAll(async () => {
    await disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create users
    counsellor = await User.create({
      name: "Counsellor",
      email: "counsellor_audit@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    student1 = await User.create({
      name: "Student 1",
      email: "student1_audit@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    student2 = await User.create({
      name: "Student 2",
      email: "student2_audit@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    admin = await User.create({
      name: "Admin",
      email: "admin_audit@test.com",
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
    tokenAdmin = generateAccessToken({ id: admin._id, role: admin.role });
  });

  test("Only Admins can query audit logs", async () => {
    const resStudent = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(resStudent.status).toBe(403);

    const resAdmin = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
  });

  test("Should log SLOT_CREATED on slot creation", async () => {
    const res = await request(app)
      .post("/api/slots")
      .set("Authorization", `Bearer ${tokenCounsellor}`)
      .send({
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        capacity: 5,
      });

    expect(res.status).toBe(201);

    const log = await Audit.findOne({ action: AUDIT_ACTIONS.SLOT_CREATED });
    expect(log).toBeDefined();
    expect(log.user.toString()).toBe(counsellor._id.toString());
    expect(log.entity).toBe("SLOT");
  });

  test("Should log BOOKING_CREATED on booking creation", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenStudent1}`)
      .send({ slotId: slot._id });

    expect(res.status).toBe(201);

    const log = await Audit.findOne({ action: AUDIT_ACTIONS.BOOKING_CREATED });
    expect(log).toBeDefined();
    expect(log.user.toString()).toBe(student1._id.toString());
    expect(log.entity).toBe("BOOKING");
    expect(log.entityId.toString()).toBe(res.body.data.id);
  });

  test("Should log BOOKING_CANCELLED and WAITLIST_PROMOTED on cancellation with waitlist", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });

    const booking = await Booking.create({
      student: student1._id,
      slot: slot._id,
      status: BOOKING_STATUS.BOOKED,
    });

    const waitlistEntry = await Waitlist.create({
      student: student2._id,
      slot: slot._id,
      status: WAITLIST_STATUS.WAITING,
      queuePosition: 1,
    });

    // Student 1 cancels booking
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(res.status).toBe(200);

    // Verify BOOKING_CANCELLED log exists
    const cancelLog = await Audit.findOne({ action: AUDIT_ACTIONS.BOOKING_CANCELLED });
    expect(cancelLog).toBeDefined();
    expect(cancelLog.user.toString()).toBe(student1._id.toString());
    expect(cancelLog.entityId.toString()).toBe(booking._id.toString());

    // Verify WAITLIST_PROMOTED log exists for student2
    const promoteLog = await Audit.findOne({ action: AUDIT_ACTIONS.WAITLIST_PROMOTED });
    expect(promoteLog).toBeDefined();
    expect(promoteLog.user.toString()).toBe(student2._id.toString());
    expect(promoteLog.entityId.toString()).toBe(waitlistEntry._id.toString());
  });

  test("Transaction rollback: aborting booking cancels audit log creation", async () => {
    const slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
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

    // Mock booking creation to fail inside promotion
    const originalCreate = bookingRepository.createBookingWithSession;
    bookingRepository.createBookingWithSession = jest.fn().mockImplementation(() => {
      throw new Error("Simulated DB failure");
    });

    // Cancel booking (which fails because of mock and rolls back transaction)
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(res.status).toBe(500);
    bookingRepository.createBookingWithSession = originalCreate;

    // Verify no audit logs were written
    const cancelLog = await Audit.findOne({ action: AUDIT_ACTIONS.BOOKING_CANCELLED });
    const promoteLog = await Audit.findOne({ action: AUDIT_ACTIONS.WAITLIST_PROMOTED });
    expect(cancelLog).toBeNull();
    expect(promoteLog).toBeNull();
  });

  test("GET /api/admin/audit-logs pagination and filtering works correctly", async () => {
    // Generate multiple logs
    const logs = [];
    for (let i = 0; i < 25; i++) {
      logs.push({
        user: student1._id,
        action: i % 2 === 0 ? AUDIT_ACTIONS.BOOKING_CREATED : AUDIT_ACTIONS.BOOKING_CANCELLED,
        entity: "BOOKING",
        entityId: new mongoose.Types.ObjectId(),
        metadata: { index: i },
      });
    }
    await Audit.create(logs);

    // Test filtering by BOOKING_CREATED on Page 1 (limit 10)
    const resFilter = await request(app)
      .get("/api/admin/audit-logs?action=BOOKING_CREATED&limit=10&page=1")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(resFilter.status).toBe(200);
    expect(resFilter.body.data.logs.length).toBe(10);
    expect(resFilter.body.data.logs.every((l) => l.action === AUDIT_ACTIONS.BOOKING_CREATED)).toBe(true);
    expect(resFilter.body.data.pagination.totalLogs).toBe(13); // 13 created, 12 cancelled
    expect(resFilter.body.data.pagination.totalPages).toBe(2);

    // Test second page pagination
    const resPage2 = await request(app)
      .get("/api/admin/audit-logs?limit=15&page=2")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(resPage2.status).toBe(200);
    expect(resPage2.body.data.logs.length).toBe(10); // 25 total, page 1 got 15, page 2 gets 10
    expect(resPage2.body.data.pagination.totalLogs).toBe(25);
  });
});
