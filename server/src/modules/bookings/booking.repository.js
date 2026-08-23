import Booking from "./booking.model.js";
import BOOKING_STATUS from "../../constants/bookingStatus.js";

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

const findStudentActiveBookings = async (studentId) => {
  return await Booking.find({
    student: studentId,
    status: BOOKING_STATUS.BOOKED,
  }).populate("slot");
};

const updateBookingStatus = async (bookingId, status, session = null) => {
  return await Booking.findByIdAndUpdate(
    bookingId,
    {
      status,
    },
    {
      new: true,
      session,
    },
  );
};

const findBookingsByStudent = async (studentId) => {
  return await Booking.find({
    student: studentId,
  })
    .populate({
      path: "slot",
      populate: {
        path: "counsellor",
        select: "name email",
      },
    })
    .sort({
      createdAt: -1,
    });
};

export default {
  createBooking,
  createBookingWithSession,
  findBookingById,
  findStudentBookingForSlot,
  findStudentActiveBookings,
  updateBookingStatus,
  findBookingsByStudent,
};
