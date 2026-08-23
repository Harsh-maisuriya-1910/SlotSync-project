import Booking from "./booking.model.js";

const createBooking = async (payload) => {
  return await Booking.create(payload);
};

const createBookingWithSession = async (payload, session) => {
  const booking = await Booking.create([payload], {
    session,
  });

  return booking[0];
};

const findBookingById = async (bookingId) => {
  return await Booking.findById(bookingId);
};

const findStudentBookingForSlot = async (studentId, slotId) => {
  return await Booking.findOne({
    student: studentId,
    slot: slotId,
  });
};

export default {
  createBooking,
  createBookingWithSession,
  findBookingById,
  findStudentBookingForSlot,
};
