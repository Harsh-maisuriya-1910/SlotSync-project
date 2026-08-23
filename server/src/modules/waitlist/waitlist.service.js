import mongoose from "mongoose";
import ApiError from "../../utility/ApiError.js";
import WAITLIST_STATUS from "../../constants/waitlistStatus.js";
import BOOKING_STATUS from "../../constants/bookingStatus.js";
import waitlistRepository from "./waitlist.repository.js";
import slotRepository from "../slots/slot.repository.js";
import bookingRepository from "../bookings/booking.repository.js";
import auditService from "../audit/audit.service.js";
import AUDIT_ACTIONS from "../../constants/auditActions.js";

const joinWaitlist = async (studentId, slotId) => {
  const slot = await slotRepository.findSlotById(slotId);

  if (!slot) {
    throw new ApiError(404, "Slot not found", "SLOT_NOT_FOUND");
  }

  // A student can only join the waitlist if the slot is fully booked
  if (slot.bookedCount < slot.capacity) {
    throw new ApiError(
      400,
      "Slot is not full, please book it instead",
      "SLOT_NOT_FULL",
    );
  }

  // Verify the student does not already have an active booking for this slot
  const existingBooking = await bookingRepository.findStudentBookingForSlot(
    studentId,
    slotId,
  );
  if (existingBooking && existingBooking.status === BOOKING_STATUS.BOOKED) {
    throw new ApiError(
      409,
      "Student already has an active booking for this slot",
      "BOOKING_ALREADY_EXISTS",
    );
  }

  // Verify the student is not already waitlisted for this slot
  const existingWaitlist = await waitlistRepository.findActiveWaitlistEntry(
    studentId,
    slotId,
  );
  if (existingWaitlist) {
    throw new ApiError(
      409,
      "Student already on the waitlist for this slot",
      "ALREADY_WAITLISTED",
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const currentCount = await waitlistRepository.countWaitingEntriesForSlot(
      slotId,
      session,
    );
    const queuePosition = currentCount + 1;

    const entry = await waitlistRepository.addToWaitlist(
      {
        student: studentId,
        slot: slotId,
        status: WAITLIST_STATUS.WAITING,
        queuePosition,
      },
      session,
    );

    await auditService.logEvent({
      user: studentId,
      action: AUDIT_ACTIONS.WAITLIST_JOINED,
      entity: "WAITLIST",
      entityId: entry._id,
      metadata: { slotId, queuePosition },
    }, session);

    await session.commitTransaction();

    return {
      id: entry._id,
      student: entry.student,
      slot: entry.slot,
      status: entry.status,
      queuePosition: entry.queuePosition,
      createdAt: entry.createdAt,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const getOwnWaitlist = async (studentId) => {
  const entries = await waitlistRepository.findWaitlistByStudent(studentId);

  return entries.map((entry) => ({
    id: entry._id,
    status: entry.status,
    queuePosition: entry.queuePosition,
    promotedAt: entry.promotedAt,
    createdAt: entry.createdAt,
    slot: entry.slot
      ? {
          id: entry.slot._id,
          startTime: entry.slot.startTime,
          endTime: entry.slot.endTime,
          capacity: entry.slot.capacity,
          bookedCount: entry.slot.bookedCount,
          counsellor: entry.slot.counsellor
            ? {
                id: entry.slot.counsellor._id,
                name: entry.slot.counsellor.name,
                email: entry.slot.counsellor.email,
              }
            : null,
        }
      : null,
  }));
};

const promoteNextStudent = async (slotId, session) => {
  const nextInQueue = await waitlistRepository.findFirstWaitingEntry(
    slotId,
    session,
  );

  if (!nextInQueue) {
    // If waitlist is empty, release the seat (decrease bookedCount)
    await slotRepository.releaseSeat(slotId, session);
    return null;
  }

  // Update waitlist entry status to PROMOTED
  await waitlistRepository.updateWaitlistEntryStatus(
    nextInQueue._id,
    WAITLIST_STATUS.PROMOTED,
    session,
  );

  // Create a new booking for the promoted student
  const booking = await bookingRepository.createBookingWithSession(
    {
      student: nextInQueue.student,
      slot: slotId,
      status: BOOKING_STATUS.BOOKED,
    },
    session,
  );

  await auditService.logEvent({
    user: nextInQueue.student,
    action: AUDIT_ACTIONS.WAITLIST_PROMOTED,
    entity: "WAITLIST",
    entityId: nextInQueue._id,
    metadata: { slotId, bookingId: booking._id },
  }, session);

  return booking;
};

export default {
  joinWaitlist,
  getOwnWaitlist,
  promoteNextStudent,
};
