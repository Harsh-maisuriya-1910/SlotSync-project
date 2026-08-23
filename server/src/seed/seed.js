import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../config/db.js";

import User from "../modules/users/user.model.js";
import Slot from "../modules/slots/slot.model.js";
import Booking from "../modules/bookings/booking.model.js";
import Waitlist from "../modules/waitlist/waitlist.model.js";

import ROLES from "../constants/roles.js";
import SLOT_STATUS from "../constants/slotStatus.js";
import BOOKING_STATUS from "../constants/bookingStatus.js";
import WAITLIST_STATUS from "../constants/waitlistStatus.js";

const SEED_RANDOM_SEED = 42;

const COUNTS = {
  ADMIN: 1,
  COUNSELLORS: 5,
  STUDENTS: 200,
  SLOTS: 300,
  BOOKINGS_TARGET: 5000,
  WAITLIST_TARGET: 800,
};

const DEMO_PASSWORD = "Password123!";
const PAST_DAYS = 30;
const FUTURE_DAYS = 21;
const INSERT_BATCH_SIZE = 1000;

// Deterministic PRNG (mulberry32) so every run produces the same dataset
const mulberry32 = (a) => {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rand = mulberry32(SEED_RANDOM_SEED);

const randomInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

const pickWeighted = (weights) => {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      return value;
    }
  }
  return Object.keys(weights)[0];
};

const shuffled = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildUsers = (passwordHash) => {
  const now = Date.now();
  const users = [
    {
      name: "SlotSync Admin",
      email: "admin@slotsync.dev",
      password: passwordHash,
      role: ROLES.ADMIN,
      createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now - 90 * 24 * 60 * 60 * 1000),
    },
  ];

  const counsellorNames = [
    "Dr. Anita Sharma",
    "Dr. Rohan Mehta",
    "Dr. Priya Nair",
    "Dr. Vikram Desai",
    "Dr. Sneha Kulkarni",
  ];

  counsellorNames.forEach((name, index) => {
    users.push({
      name,
      email: `counsellor${index + 1}@slotsync.dev`,
      password: passwordHash,
      role: ROLES.COUNSELLOR,
      createdAt: new Date(now - (80 - index) * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now - (80 - index) * 24 * 60 * 60 * 1000),
    });
  });

  const departments = ["CSE", "IT", "ECE", "ME", "CE", "MBA"];

  for (let i = 1; i <= COUNTS.STUDENTS; i += 1) {
    const dept = departments[i % departments.length];
    users.push({
      name: `Student ${i} (${dept})`,
      email: `student${i}@slotsync.dev`,
      password: passwordHash,
      role: ROLES.STUDENT,
      createdAt: new Date(now - randomInt(20, 75) * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now - randomInt(1, 19) * 24 * 60 * 60 * 1000),
    });
  }

  return users;
};

const buildSlots = (counsellors) => {
  const slots = [];
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000,
  );
  windowStart.setHours(9, 0, 0, 0);

  const sessionsPerCounsellor = COUNTS.SLOTS / counsellors.length;

  counsellors.forEach((counsellor, cIndex) => {
    let cursor = new Date(windowStart);
    cursor.setHours(9 + cIndex, 0, 0, 0); // stagger counsellors across hours

    for (let s = 0; s < sessionsPerCounsellor; s += 1) {
      // Advance the cursor by 2-9 hours, skipping forward over nights randomly
      const gapHours = randomInt(2, 9);
      cursor = new Date(cursor.getTime() + gapHours * 60 * 60 * 1000);

      const hour = cursor.getHours();
      if (hour >= 18) {
        // Move to next working day at 9 AM
        const nextDay = new Date(cursor);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(9, 0, 0, 0);
        cursor = nextDay;
      }

      const durationMinutes = pickWeighted({ 30: 3, 45: 4, 60: 3 });

      slots.push({
        counsellor: counsellor._id,
        startTime: new Date(cursor),
        endTime: new Date(cursor.getTime() + durationMinutes * 60 * 1000),
        capacity: randomInt(15, 25),
        bookedCount: 0,
        status: SLOT_STATUS.AVAILABLE,
        createdAt: new Date(cursor.getTime() - randomInt(7, 20) * 24 * 60 * 60 * 1000),
        updatedAt: new Date(cursor.getTime() - randomInt(1, 6) * 24 * 60 * 60 * 1000),
      });
    }
  });

  return slots;
};

const bookingStatusFor = (slotStartTime, neverCancels) => {
  const now = Date.now();

  if (slotStartTime.getTime() < now) {
    if (neverCancels) {
      return pickWeighted({
        [BOOKING_STATUS.ATTENDED]: 88,
        [BOOKING_STATUS.NO_SHOW]: 12,
      });
    }

    return pickWeighted({
      [BOOKING_STATUS.ATTENDED]: 72,
      [BOOKING_STATUS.NO_SHOW]: 10,
      [BOOKING_STATUS.CANCELLED]: 18,
    });
  }

  if (neverCancels) {
    return BOOKING_STATUS.BOOKED;
  }

  return pickWeighted({
    [BOOKING_STATUS.BOOKED]: 88,
    [BOOKING_STATUS.CANCELLED]: 12,
  });
};

const buildBookingsAndSlots = (students, slotDocs) => {
  const bookings = [];
  const studentIds = students.map((s) => s._id);

  slotDocs.forEach((slotDoc) => {
    // ~35% of slots fill to capacity (drives realistic waitlists),
    // the rest fill 55-95% of seats
    const fillsToCapacity = rand() < 0.35;
    const activeTarget = fillsToCapacity
      ? slotDoc.capacity
      : Math.max(
          1,
          Math.round(slotDoc.capacity * (0.55 + rand() * 0.4)),
        );

    const chosen = shuffled(studentIds).slice(0, activeTarget);

    chosen.forEach((studentId) => {
      const status = bookingStatusFor(slotDoc.startTime, fillsToCapacity);

      const maxLeadDays = Math.min(
        10,
        Math.max(
          0,
          (slotDoc.startTime.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        ),
      );
      const leadMs =
        (randomInt(1, 240) * 60 * 60 * 1000) +
        Math.floor(rand() * Math.max(maxLeadDays, 0.04) * 24 * 60 * 60 * 1000);

      const createdAt = new Date(
        Math.max(
          slotDoc.startTime.getTime() - leadMs,
          slotDoc.createdAt.getTime(),
          Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000,
        ),
      );

      bookings.push({
        student: studentId,
        slot: slotDoc._id,
        status,
        createdAt,
        updatedAt: createdAt,
      });
    });
  });

  return bookings;
};

const applyBookingOutcomeToSlots = async (slotDocs) => {
  const activeCounts = await Booking.aggregate([
    { $match: { status: { $ne: BOOKING_STATUS.CANCELLED } } },
    { $group: { _id: "$slot", count: { $sum: 1 } } },
  ]);

  const countBySlot = new Map(
    activeCounts.map((row) => [row._id.toString(), row.count]),
  );

  const bulkOps = slotDocs.map((slotDoc) => {
    const active = countBySlot.get(slotDoc._id.toString()) || 0;

    // Keep in-memory copies consistent for downstream steps
    slotDoc.bookedCount = active;
    slotDoc.status =
      active >= slotDoc.capacity ? SLOT_STATUS.FULL : SLOT_STATUS.AVAILABLE;

    return {
      updateOne: {
        filter: { _id: slotDoc._id },
        update: {
          $set: {
            bookedCount: active,
            status:
              active >= slotDoc.capacity
                ? SLOT_STATUS.FULL
                : SLOT_STATUS.AVAILABLE,
          },
        },
      },
    };
  });

  await Slot.bulkWrite(bulkOps, { ordered: false });
};

const buildWaitlistEntries = async (students, slotDocs) => {
  const now = Date.now();

  const fullSlots = slotDocs.filter((slot) => slot.bookedCount >= slot.capacity);

  const bookedPairs = new Set(
    (
      await Booking.find({}, { student: 1, slot: 1 }).lean()
    ).map((b) => `${b.student.toString()}#${b.slot.toString()}`),
  );

  const entriesPerFullSlot = Math.max(
    1,
    Math.round(COUNTS.WAITLIST_TARGET / Math.max(fullSlots.length, 1)),
  );

  const docs = [];
  const studentIds = students.map((s) => s._id);

  for (const slotDoc of fullSlots) {
    const eligible = shuffled(
      studentIds.filter(
        (studentId) =>
          !bookedPairs.has(`${studentId.toString()}#${slotDoc._id.toString()}`),
      ),
    ).slice(0, entriesPerFullSlot);

    eligible.forEach((studentId, position) => {
      const isPast = slotDoc.startTime.getTime() < now;
      const status = isPast
        ? pickWeighted({
            [WAITLIST_STATUS.PROMOTED]: 70,
            [WAITLIST_STATUS.CANCELLED]: 30,
          })
        : pickWeighted({
            [WAITLIST_STATUS.WAITING]: 90,
            [WAITLIST_STATUS.PROMOTED]: 10,
          });

      const joinedAt = new Date(
        slotDoc.startTime.getTime() -
          randomInt(2, 120) * 60 * 60 * 1000,
      );

      docs.push({
        student: studentId,
        slot: slotDoc._id,
        status,
        queuePosition: position + 1,
        promotedAt:
          status === WAITLIST_STATUS.PROMOTED
            ? new Date(
                Math.min(
                  joinedAt.getTime() + randomInt(1, 48) * 60 * 60 * 1000,
                  Math.max(slotDoc.startTime.getTime(), joinedAt.getTime()),
                ),
              )
            : undefined,
        createdAt: joinedAt,
        updatedAt: joinedAt,
      });
    });
  }

  return docs;
};

const chunkedInsertMany = async (Model, docs) => {
  for (let i = 0; i < docs.length; i += INSERT_BATCH_SIZE) {
    await Model.insertMany(docs.slice(i, i + INSERT_BATCH_SIZE), {
      ordered: false,
    });
  }
};

const verifyReferentialIntegrity = async () => {
  const orphanBookings = await Booking.aggregate([
    {
      $lookup: {
        from: "slots",
        localField: "slot",
        foreignField: "_id",
        as: "slotRef",
      },
    },
    { $match: { slotRef: { $size: 0 } } },
    { $count: "orphans" },
  ]);

  const duplicateBookings = await Booking.aggregate([
    { $group: { _id: { student: "$student", slot: "$slot" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "dupes" },
  ]);

  const mismatchedSlots = await Booking.aggregate([
    { $match: { status: { $ne: BOOKING_STATUS.CANCELLED } } },
    { $group: { _id: "$slot", active: { $sum: 1 } } },
    {
      $lookup: {
        from: "slots",
        localField: "_id",
        foreignField: "_id",
        as: "slotRef",
      },
    },
    { $unwind: "$slotRef" },
    {
      $match: {
        $expr: { $ne: ["$active", "$slotRef.bookedCount"] },
      },
    },
    { $count: "mismatches" },
  ]);

  return {
    orphanBookings: orphanBookings[0]?.orphans || 0,
    duplicateBookings: duplicateBookings[0]?.dupes || 0,
    mismatchedSlots: mismatchedSlots[0]?.mismatches || 0,
  };
};

const printReport = async (integrity) => {
  const [
    adminCount,
    counsellorCount,
    studentCount,
    slotCount,
    bookingCount,
    waitlistCount,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.ADMIN }),
    User.countDocuments({ role: ROLES.COUNSELLOR }),
    User.countDocuments({ role: ROLES.STUDENT }),
    Slot.countDocuments(),
    Booking.countDocuments(),
    Waitlist.countDocuments(),
  ]);

  console.log("\n================ SEED REPORT ================");
  console.log(`Admin Count ............ ${adminCount}`);
  console.log(`Counsellor Count ....... ${counsellorCount}`);
  console.log(`Student Count .......... ${studentCount}`);
  console.log(`Slot Count ............. ${slotCount}`);
  console.log(`Booking Count .......... ${bookingCount}`);
  console.log(`Waitlist Count ......... ${waitlistCount}`);
  console.log("---------------------------------------------");
  console.log(`Orphan Bookings ........ ${integrity.orphanBookings} (expect 0)`);
  console.log(`Duplicate Bookings ..... ${integrity.duplicateBookings} (expect 0)`);
  console.log(`bookedCount Mismatches . ${integrity.mismatchedSlots} (expect 0)`);

  const passed =
    integrity.orphanBookings === 0 &&
    integrity.duplicateBookings === 0 &&
    integrity.mismatchedSlots === 0 &&
    adminCount === COUNTS.ADMIN &&
    counsellorCount === COUNTS.COUNSELLORS &&
    studentCount === COUNTS.STUDENTS &&
    slotCount === COUNTS.SLOTS;

  console.log(`Result ................. ${passed ? "PASS" : "FAIL"}`);
  console.log("=============================================\n");

  return passed;
};

const seed = async () => {
  try {
    await connectDB();
    console.log("Connected. Wiping existing collections...");

    await Promise.all([
      User.deleteMany({}),
      Slot.deleteMany({}),
      Booking.deleteMany({}),
      Waitlist.deleteMany({}),
    ]);

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    console.log("Seeding users...");
    await chunkedInsertMany(User, buildUsers(passwordHash));

    const counsellors = await User.find({ role: ROLES.COUNSELLOR }).lean();
    const students = await User.find({ role: ROLES.STUDENT })
      .select("_id")
      .lean();

    console.log("Seeding slots...");
    const slotDocs = await Slot.insertMany(buildSlots(counsellors), {
      ordered: false,
    });

    console.log("Seeding bookings...");
    const bookingDocs = buildBookingsAndSlots(students, slotDocs);
    await chunkedInsertMany(Booking, bookingDocs);

    console.log("Reconciling slot bookedCount/status...");
    await applyBookingOutcomeToSlots(slotDocs);

    console.log("Seeding waitlist...");
    const waitlistDocs = await buildWaitlistEntries(students, slotDocs);
    await chunkedInsertMany(Waitlist, waitlistDocs);

    const integrity = await verifyReferentialIntegrity();
    const passed = await printReport(integrity);

    await mongoose.disconnect();

    if (!passed) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seed();
