import connectDB from "../config/db.js";
import User from "../modules/users/user.model.js";
import Slot from "../modules/slots/slot.model.js";
import Booking from "../modules/bookings/booking.model.js";
import Waitlist from "../modules/waitlist/waitlist.model.js";
import Audit from "../modules/audit/audit.model.js";
import IdempotencyRecord from "../modules/bookings/idempotencyRecord.model.js";
import ROLES from "../constants/roles.js";
import env from "../config/env.js";
import SLOT_STATUS from "../constants/slotStatus.js";
import BOOKING_STATUS from "../constants/bookingStatus.js";
import WAITLIST_STATUS from "../constants/waitlistStatus.js";
import AUDIT_ACTIONS from "../constants/auditActions.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log("Database connected. Starting seed operation...");

    // Clear existing data using the raw MongoDB driver collections to bypass append-only hooks on Audit
    await User.collection.deleteMany({});
    await Slot.collection.deleteMany({});
    await Booking.collection.deleteMany({});
    await Waitlist.collection.deleteMany({});
    await Audit.collection.deleteMany({});
    await IdempotencyRecord.collection.deleteMany({});
    console.log("Existing collections cleared.");

    // 1. Create Admin
    // IMPORTANT: User.create() triggers the pre-save bcrypt hook which hashes passwords.
    // So we pass the PLAIN password here — it gets hashed to cost-12 by the model hook.
    // For insertMany (bulk insert), the hook does NOT fire, so we must provide an already-hashed password.
    const adminEmail = env.ADMIN_EMAIL || "admin@slotsync.com";
    const plainPassword = "Password123!";
    const preHashedPassword = await bcrypt.hash(plainPassword, 12);

    const adminUser = await User.create({
      name: env.ADMIN_NAME || "System Admin",
      email: adminEmail,
      password: plainPassword, // Will be hashed once by pre-save hook
      role: ROLES.ADMIN,
    });
    console.log("Admin seeded successfully.");

    // 2. Create 5 Counsellors
    const counsellorsData = [];
    for (let i = 1; i <= 5; i++) {
      counsellorsData.push({
        name: `Counsellor ${i}`,
        email: `counsellor${i}@slotsync.com`,
        password: preHashedPassword,
        role: ROLES.COUNSELLOR,
      });
    }
    const counsellors = await User.insertMany(counsellorsData);
    console.log(`Seeded ${counsellors.length} counsellors.`);

    // 3. Create 200 Students
    const studentsData = [];
    for (let i = 1; i <= 200; i++) {
      studentsData.push({
        name: `Student ${i}`,
        email: `student${i}@slotsync.com`,
        password: preHashedPassword,
        role: ROLES.STUDENT,
      });
    }
    const students = await User.insertMany(studentsData);
    console.log(`Seeded ${students.length} students.`);

    // 4. Create 300 Slots spread across last 14 and next 14 days
    const slotsData = [];
    const now = new Date();

    for (let i = 0; i < 300; i++) {
      // Offset from -14 to +14 days
      const dayOffset = Math.floor((i / 10)) - 14;
      const hourOffset = (i % 10) + 9; // Slots between 9 AM and 6 PM

      const startTime = new Date(now);
      startTime.setDate(now.getDate() + dayOffset);
      startTime.setHours(hourOffset, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);

      const counsellor = counsellors[i % 5];
      const capacity = 2;

      slotsData.push({
        counsellor: counsellor._id,
        startTime,
        endTime,
        capacity,
        bookedCount: 0,
        status: SLOT_STATUS.AVAILABLE,
        version: 0,
      });
    }

    const slots = await Slot.insertMany(slotsData);
    console.log(`Seeded ${slots.length} slots.`);

    // Helper: shuffle students list
    const shuffleArray = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const bookingsToInsert = [];
    const waitlistsToInsert = [];
    const auditLogsToInsert = [];

    // Log Slot creations
    slots.forEach((slot) => {
      auditLogsToInsert.push({
        user: slot.counsellor,
        action: AUDIT_ACTIONS.SLOT_CREATED,
        entity: "SLOT",
        entityId: slot._id,
        metadata: { capacity: slot.capacity, startTime: slot.startTime, endTime: slot.endTime },
        createdAt: slot.createdAt || new Date(),
      });
    });

    // 5. Generate ~5,000 Bookings and ~800 Waitlist Entries
    // For each of the 300 slots:
    // We pick 20 random students.
    // - 15 get active bookings (attending / no-show / booked)
    // - 2 get cancelled bookings (so capacity occupied = 15, total bookings = 17)
    // - 3 get waitlist entries (so waitlist count = 3)
    // Total Bookings: 300 slots * 17 = 5,100 bookings (perfect match for ~5,000)
    // Total Waitlists: 300 slots * 3 = 900 waitlist entries (perfect match for ~800)
    console.log("Generating bookings, waitlists and audit logs...");

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex];
      const isPast = slot.startTime < now;

      // Select 20 random students for this slot
      const selectedStudents = shuffleArray(students).slice(0, 20);

      // A. Seed Bookings (Active capacity = 2)
      for (let j = 0; j < 2; j++) {
        const student = selectedStudents[j];
        let status = BOOKING_STATUS.BOOKED;

        if (isPast) {
          // If in the past: 80% Attended, 20% No Show
          status = j % 5 === 0 ? BOOKING_STATUS.NO_SHOW : BOOKING_STATUS.ATTENDED;
        }

        const bookingId = new mongoose.Types.ObjectId();
        bookingsToInsert.push({
          _id: bookingId,
          student: student._id,
          slot: slot._id,
          status,
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 2), // 2 days before slot
        });

        auditLogsToInsert.push({
          user: student._id,
          action: AUDIT_ACTIONS.BOOKING_CREATED,
          entity: "BOOKING",
          entityId: bookingId,
          metadata: { slotId: slot._id },
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 2),
        });

        if (isPast && status === BOOKING_STATUS.ATTENDED) {
          auditLogsToInsert.push({
            user: slot.counsellor,
            action: AUDIT_ACTIONS.OUTCOME_UPDATED,
            entity: "BOOKING",
            entityId: bookingId,
            metadata: { status: BOOKING_STATUS.ATTENDED },
            createdAt: new Date(slot.endTime.getTime() + 10 * 60 * 1000), // 10 mins after slot end
          });
        }
      }

      // B. Seed Cancelled Bookings (2 per slot)
      for (let j = 2; j < 4; j++) {
        const student = selectedStudents[j];
        const bookingId = new mongoose.Types.ObjectId();

        bookingsToInsert.push({
          _id: bookingId,
          student: student._id,
          slot: slot._id,
          status: BOOKING_STATUS.CANCELLED,
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 3),
        });

        auditLogsToInsert.push({
          user: student._id,
          action: AUDIT_ACTIONS.BOOKING_CREATED,
          entity: "BOOKING",
          entityId: bookingId,
          metadata: { slotId: slot._id },
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 3),
        });

        auditLogsToInsert.push({
          user: student._id,
          action: AUDIT_ACTIONS.BOOKING_CANCELLED,
          entity: "BOOKING",
          entityId: bookingId,
          metadata: { slotId: slot._id },
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 2.5),
        });
      }

      // Update slot's bookedCount field in the database
      // The capacity is 2 and it has 2 active bookings
      slot.bookedCount = 2;
      if (isPast) {
        slot.status = SLOT_STATUS.COMPLETED;
      } else {
        slot.status = SLOT_STATUS.FULL;
      }
      await slot.save();

      // C. Seed Waitlist Entries (3 per slot)
      for (let j = 4; j < 7; j++) {
        const student = selectedStudents[j];
        const queuePosition = j - 3; // 1, 2, 3

        const waitlistId = new mongoose.Types.ObjectId();
        waitlistsToInsert.push({
          _id: waitlistId,
          student: student._id,
          slot: slot._id,
          status: WAITLIST_STATUS.WAITING,
          queuePosition,
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 1), // 1 day before slot
        });

        auditLogsToInsert.push({
          user: student._id,
          action: AUDIT_ACTIONS.WAITLIST_JOINED,
          entity: "WAITLIST",
          entityId: waitlistId,
          metadata: { slotId: slot._id, queuePosition },
          createdAt: new Date(slot.startTime.getTime() - 24 * 60 * 60 * 1000 * 1),
        });
      }
    }

    // Bulk insert everything
    console.log("Writing bookings to database...");
    await Booking.insertMany(bookingsToInsert);
    console.log(`Seeded ${bookingsToInsert.length} bookings.`);

    console.log("Writing waitlists to database...");
    await Waitlist.insertMany(waitlistsToInsert);
    console.log(`Seeded ${waitlistsToInsert.length} waitlist entries.`);

    console.log("Writing audit logs to database...");
    await Audit.insertMany(auditLogsToInsert);
    console.log(`Seeded ${auditLogsToInsert.length} audit logs.`);

    console.log("--- SEED OPERATION COMPLETED SUCCESSFULY ---");
    console.log("Summary of created documents:");
    console.log("- Admins: 1");
    console.log(`- Counsellors: ${counsellors.length}`);
    console.log(`- Students: ${students.length}`);
    console.log(`- Slots: ${slots.length}`);
    console.log(`- Bookings: ${bookingsToInsert.length}`);
    console.log(`- Waitlist Entries: ${waitlistsToInsert.length}`);
    console.log(`- Audit Logs: ${auditLogsToInsert.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seedDatabase();
