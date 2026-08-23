import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { connect, disconnect, clearDatabase } from "../setup/mongodb.js";
import User from "../../src/modules/users/user.model.js";
import Slot from "../../src/modules/slots/slot.model.js";
import Booking from "../../src/modules/bookings/booking.model.js";
import { generateAccessToken } from "../../src/utility/jwt.js";
import ROLES from "../../src/constants/roles.js";
import SLOT_STATUS from "../../src/constants/slotStatus.js";
import BOOKING_STATUS from "../../src/constants/bookingStatus.js";
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Admin Dashboard Analytics API", () => {
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
  });

  test("Should restrict analytics endpoint to Admin only", async () => {
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

    const adminToken = generateAccessToken({ id: admin._id, role: admin.role });
    const counsellorToken = generateAccessToken({
      id: counsellor._id,
      role: counsellor.role,
    });
    const studentToken = generateAccessToken({
      id: student._id,
      role: student.role,
    });

    // Admin should succeed (200)
    const adminRes = await request(app)
      .get("/api/analytics/admin")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);

    // Counsellor should be forbidden (403)
    const counsellorRes = await request(app)
      .get("/api/analytics/admin")
      .set("Authorization", `Bearer ${counsellorToken}`);
    expect(counsellorRes.status).toBe(403);

    // Student should be forbidden (403)
    const studentRes = await request(app)
      .get("/api/analytics/admin")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentRes.status).toBe(403);

    // Unauthenticated should be unauthorized (401)
    const unauthRes = await request(app).get("/api/analytics/admin");
    expect(unauthRes.status).toBe(401);
  });

  test("Should calculate analytics correctly", async () => {
    // 1. Create Admin
    const admin = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "Password123!",
      role: ROLES.ADMIN,
    });
    const adminToken = generateAccessToken({ id: admin._id, role: admin.role });

    // 2. Create Users: 2 counsellors, 3 students
    const counsellor1 = await User.create({
      name: "Counsellor 1",
      email: "counsellor1@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });
    const counsellor2 = await User.create({
      name: "Counsellor 2",
      email: "counsellor2@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const student1 = await User.create({
      name: "Student 1",
      email: "student1@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });
    const student2 = await User.create({
      name: "Student 2",
      email: "student2@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });
    const student3 = await User.create({
      name: "Student 3",
      email: "student3@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    // Total Users in system: Admin (1) + Counsellors (2) + Students (3) = 6

    // 3. Create Slots
    // Slot 1: Capacity 5, bookedCount 3 (Available)
    const slot1 = await Slot.create({
      counsellor: counsellor1._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 3,
      status: SLOT_STATUS.AVAILABLE,
    });

    // Slot 2: Capacity 2, bookedCount 2 (Fully Booked)
    const slot2 = await Slot.create({
      counsellor: counsellor1._id,
      startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
      capacity: 2,
      bookedCount: 2,
      status: SLOT_STATUS.FULL,
    });

    // Slot 3: Capacity 3, bookedCount 0 (Available)
    const slot3 = await Slot.create({
      counsellor: counsellor2._id,
      startTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 60 * 60 * 1000),
      capacity: 3,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    // Total capacity: 5 + 2 + 3 = 10
    // Total booked: 3 + 2 + 0 = 5
    // Expected utilization: 50.00%
    // Slots: 3 total, 2 available, 1 fully booked

    // 4. Create Bookings
    // 3 Attended bookings
    await Booking.create([
      { student: student1._id, slot: slot1._id, status: BOOKING_STATUS.ATTENDED },
      { student: student2._id, slot: slot1._id, status: BOOKING_STATUS.ATTENDED },
      { student: student3._id, slot: slot1._id, status: BOOKING_STATUS.ATTENDED },
    ]);

    // 2 Cancelled bookings
    await Booking.create([
      { student: student1._id, slot: slot2._id, status: BOOKING_STATUS.CANCELLED },
      { student: student2._id, slot: slot2._id, status: BOOKING_STATUS.CANCELLED },
    ]);

    // 1 No-Show booking
    await Booking.create([
      { student: student3._id, slot: slot2._id, status: BOOKING_STATUS.NO_SHOW },
    ]);

    // Bookings count: 3 attended, 2 cancelled, 1 no_show. Total bookings = 6.

    // 5. Query Analytics
    const res = await request(app)
      .get("/api/analytics/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.users.totalStudents).toBe(3);
    expect(data.users.totalCounsellors).toBe(2);
    expect(data.users.totalUsers).toBe(6);

    expect(data.slots.totalSlots).toBe(3);
    expect(data.slots.availableSlots).toBe(2);
    expect(data.slots.fullyBookedSlots).toBe(1);

    expect(data.bookings.totalBookings).toBe(6);
    expect(data.bookings.cancelledBookings).toBe(2);
    expect(data.bookings.attendedBookings).toBe(3);
    expect(data.bookings.noShowBookings).toBe(1);

    expect(data.utilization.totalCapacity).toBe(10);
    expect(data.utilization.totalReservedSeats).toBe(5);
    expect(data.utilization.utilizationPercentage).toBe(50.0);
  });

  test("Should calculate Counsellor Dashboard Analytics correctly", async () => {
    // 1. Create Counsellor 1 and Counsellor 2
    const counsellor1 = await User.create({
      name: "Counsellor 1",
      email: "counsellor1_dashboard@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });
    const counsellor2 = await User.create({
      name: "Counsellor 2",
      email: "counsellor2_dashboard@test.com",
      password: "Password123!",
      role: ROLES.COUNSELLOR,
    });

    const token1 = generateAccessToken({ id: counsellor1._id, role: counsellor1.role });
    const token2 = generateAccessToken({ id: counsellor2._id, role: counsellor2.role });

    const student1 = await User.create({
      name: "Student 1",
      email: "student1_dashboard@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });
    const student2 = await User.create({
      name: "Student 2",
      email: "student2_dashboard@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });
    const student3 = await User.create({
      name: "Student 3",
      email: "student3_dashboard@test.com",
      password: "Password123!",
      role: ROLES.STUDENT,
    });

    // 2. Create Slots for Counsellor 1
    // Slot 1: Capacity 5, bookedCount 3 (Upcoming)
    const slot1 = await Slot.create({
      counsellor: counsellor1._id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      capacity: 5,
      bookedCount: 3,
      status: SLOT_STATUS.AVAILABLE,
    });

    // Slot 2: Capacity 2, bookedCount 2 (Completed)
    const slot2 = await Slot.create({
      counsellor: counsellor1._id,
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      capacity: 2,
      bookedCount: 2,
      status: SLOT_STATUS.FULL,
    });

    // Slot 3: Capacity 3, bookedCount 0 (Upcoming, but for Counsellor 2)
    const slot3 = await Slot.create({
      counsellor: counsellor2._id,
      startTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 7 * 60 * 60 * 1000),
      capacity: 3,
      bookedCount: 0,
      status: SLOT_STATUS.AVAILABLE,
    });

    // 3. Create Bookings for Counsellor 1's slots
    // 3 Bookings on Slot 1 (2 attended, 1 booked)
    await Booking.create([
      { student: student1._id, slot: slot1._id, status: BOOKING_STATUS.ATTENDED },
      { student: student2._id, slot: slot1._id, status: BOOKING_STATUS.ATTENDED },
      { student: student3._id, slot: slot1._id, status: BOOKING_STATUS.BOOKED },
    ]);

    // 2 Bookings on Slot 2 (1 no show, 1 cancelled)
    await Booking.create([
      { student: student1._id, slot: slot2._id, status: BOOKING_STATUS.NO_SHOW },
      { student: student2._id, slot: slot2._id, status: BOOKING_STATUS.CANCELLED },
    ]);

    // 4. Query Counsellor 1 Dashboard
    const res = await request(app)
      .get("/api/counsellor/dashboard")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    // Expected Slots: 2 total (Slot 1 and 2), 1 upcoming (Slot 1), 1 completed (Slot 2)
    expect(data.totalSlots).toBe(2);
    expect(data.upcomingSlots).toBe(1);
    expect(data.completedSlots).toBe(1);

    // Expected Bookings: 5 total bookings for Slot 1 and Slot 2
    expect(data.totalBookings).toBe(5);
    expect(data.attendedCount).toBe(2);
    expect(data.noShowCount).toBe(1);

    // Expected Utilization: total capacity: 5 + 2 = 7, total reserved: 3 + 2 = 5
    // 5/7 * 100 = 71.43%
    expect(data.utilizationPercentage).toBe(71.43);

    // 5. Query Counsellor 2 Dashboard (should be 0/empty stats since no bookings, 1 slot)
    const res2 = await request(app)
      .get("/api/counsellor/dashboard")
      .set("Authorization", `Bearer ${token2}`);

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    const data2 = res2.body.data;
    expect(data2.totalSlots).toBe(1);
    expect(data2.upcomingSlots).toBe(1);
    expect(data2.completedSlots).toBe(0);
    expect(data2.totalBookings).toBe(0);
    expect(data2.attendedCount).toBe(0);
    expect(data2.noShowCount).toBe(0);
    expect(data2.utilizationPercentage).toBe(0);
  });
});
