import mongoose from "mongoose";

import ApiError from "../../utility/ApiError.js";

import BOOKING_STATUS from "../../constants/bookingStatus.js";

import bookingRepository from "./booking.repository.js";
import slotRepository from "../slots/slot.repository.js";
import waitlistService from "../waitlist/waitlist.service.js";
import auditService from "../audit/audit.service.js";
import AUDIT_ACTIONS from "../../constants/auditActions.js";

const createBooking = async (studentId, slotId) => {
  const slot = await slotRepository.findSlotById(slotId);

  if (!slot) {
    throw new ApiError(404, "Slot not found", "SLOT_NOT_FOUND");
  }

  const now = new Date();

  const bookingWindowMinutes = (slot.startTime - now) / (1000 * 60);

  if (bookingWindowMinutes < 30) {
    throw new ApiError(422, "Booking window closed", "BOOKING_WINDOW_CLOSED");
  }

  const existingBooking = await bookingRepository.findStudentBookingForSlot(
    studentId,
    slotId,
  );

  if (existingBooking && existingBooking.status === BOOKING_STATUS.BOOKED) {
    throw new ApiError(409, "Slot already booked", "BOOKING_ALREADY_EXISTS");
  }

  const activeBookings =
    await bookingRepository.findStudentActiveBookings(studentId);

  const hasOverlap = activeBookings.some((booking) => {
    if (!booking.slot) {
      return false;
    }

    return (
      booking.slot.startTime < slot.endTime &&
      booking.slot.endTime > slot.startTime
    );
  });

  if (hasOverlap) {
    throw new ApiError(
      409,
      "Overlapping booking exists",
      "OVERLAPPING_BOOKING",
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const reservedSlot = await slotRepository.reserveSeat(slotId, session);

    if (!reservedSlot) {
      throw new ApiError(409, "Slot is full", "SLOT_FULL");
    }

    const booking = await bookingRepository.createBookingWithSession(
      {
        student: studentId,
        slot: slotId,
        status: BOOKING_STATUS.BOOKED,
      },
      session,
    );

    await auditService.logEvent({
      user: studentId,
      action: AUDIT_ACTIONS.BOOKING_CREATED,
      entity: "BOOKING",
      entityId: booking._id,
      metadata: { slotId },
    }, session);

    await session.commitTransaction();

    return {
      id: booking._id,
      student: booking.student,
      slot: booking.slot,
      status: booking.status,
      createdAt: booking.createdAt,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const cancelBooking = async (studentId, bookingId) => {
  const booking = await bookingRepository.findBookingById(bookingId);

  if (!booking) {
    throw new ApiError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }

  if (booking.student.toString() !== studentId) {
    throw new ApiError(403, "Access forbidden", "ACCESS_FORBIDDEN");
  }

  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(
      409,
      "Booking already cancelled",
      "BOOKING_ALREADY_CANCELLED",
    );
  }

  const slot = await slotRepository.findSlotById(booking.slot);
  if (!slot) {
    throw new ApiError(404, "Slot not found", "SLOT_NOT_FOUND");
  }

  const cancellationWindowMinutes = (slot.startTime - new Date()) / (1000 * 60);

  if (cancellationWindowMinutes < 120) {
    throw new ApiError(
      422,
      "Cancellation window closed",
      "CANCELLATION_WINDOW_CLOSED",
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await bookingRepository.updateBookingStatus(
      bookingId,
      BOOKING_STATUS.CANCELLED,
      session,
    );

    await waitlistService.promoteNextStudent(booking.slot, session);

    await auditService.logEvent({
      user: studentId,
      action: AUDIT_ACTIONS.BOOKING_CANCELLED,
      entity: "BOOKING",
      entityId: bookingId,
      metadata: { slotId: booking.slot },
    }, session);

    await session.commitTransaction();

    return {
      id: booking._id,
      status: BOOKING_STATUS.CANCELLED,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const getMyBookings = async (studentId) => {
  const bookings = await bookingRepository.findBookingsByStudent(studentId);

  return bookings.map((booking) => ({
    id: booking._id,
    status: booking.status,
    createdAt: booking.createdAt,

    slot: booking.slot
      ? {
          id: booking.slot._id,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          capacity: booking.slot.capacity,
          bookedCount: booking.slot.bookedCount,

          counsellor: booking.slot.counsellor
            ? {
                id: booking.slot.counsellor._id,
                name: booking.slot.counsellor.name,
                email: booking.slot.counsellor.email,
              }
            : null,
        }
      : null,
  }));
};

export default {
  createBooking,
  cancelBooking,
  getMyBookings,
};
