import asyncHandler from "../../utility/asyncHandler.js";
import ApiResponse from "../../utility/ApiResponse.js";

import bookingService from "./booking.service.js";

const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(
    req.user.id,
    req.body.slotId,
    { idempotencyKey: req.header("Idempotency-Key") },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, booking, "Booking created successfully"));
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(
    req.user.id,
    req.params.bookingId,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, booking, "Booking cancelled successfully"));
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookings(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
});

export default {
  createBooking,
  cancelBooking,
  getMyBookings,
};
