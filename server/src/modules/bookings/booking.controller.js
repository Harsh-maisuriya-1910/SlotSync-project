import asyncHandler from "../../utility/asyncHandler.js";
import ApiResponse from "../../utility/ApiResponse.js";

import bookingService from "./booking.service.js";

const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(
    req.user.id,
    req.body.slotId,
  );

  return res
    .status(201)
    .json(new ApiResponse(201, booking, "Booking created successfully"));
});

export default {
  createBooking,
};
