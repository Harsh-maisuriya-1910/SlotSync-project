import ApiError from "../../utility/ApiError.js";

import BOOKING_STATUS from "../../constants/bookingStatus.js";

import bookingRepository from "./booking.repository.js";
import slotRepository from "../slots/slot.repository.js";

const createBooking = async (studentId, slotId) => {
  const slot = await slotRepository.findSlotById(slotId);

  if (!slot) {
    throw new ApiError(404, "Slot not found", "SLOT_NOT_FOUND");
  }

  const now = new Date();

  const bookingWindowMinutes = (new Date(slot.startTime) - now) / (1000 * 60);

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

  const booking = await bookingRepository.createBooking({
    student: studentId,
    slot: slotId,
    status: BOOKING_STATUS.BOOKED,
  });

  return {
    id: booking._id,
    student: booking.student,
    slot: booking.slot,
    status: booking.status,
    createdAt: booking.createdAt,
  };
};

export default {
  createBooking,
};
