import request from "supertest";
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
import { jest } from "@jest/globals";

jest.setTimeout(60000);

describe("Bookings: Waitlist Promotion Integration Tests", () => {
  let counsellor, student1, student2, tokenStudent1;
  let slot;

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

    tokenStudent1 = generateAccessToken({ id: student1._id, role: student1.role });

    slot = await Slot.create({
      counsellor: counsellor._id,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 1,
      status: SLOT_STATUS.FULL,
    });
  });

  test("Booking cancellation triggers promotion, creates new booking and preserves slot bookedCount", async () => {
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

    // Student 1 cancels
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenStudent1}`);

    expect(res.status).toBe(200);

    // Verify student2 waitlist updated to PROMOTED
    const updatedWaitlist = await Waitlist.findById(waitlistEntry._id);
    expect(updatedWaitlist.status).toBe(WAITLIST_STATUS.PROMOTED);

    // Verify booking created for student2
    const promotedBooking = await Booking.findOne({ student: student2._id, slot: slot._id });
    expect(promotedBooking).toBeDefined();
    expect(promotedBooking.status).toBe(BOOKING_STATUS.BOOKED);

    // Verify slot remains FULL (bookedCount = 1)
    const updatedSlot = await Slot.findById(slot._id);
    expect(updatedSlot.bookedCount).toBe(1);
  });
});
