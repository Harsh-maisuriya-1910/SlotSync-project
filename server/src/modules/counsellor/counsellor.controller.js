import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import counsellorService from "./counsellor.service.js";

const getOwnSlots = asyncHandler(async (req, res) => {
  const slots = await counsellorService.getOwnSlots(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, slots, "Own slots fetched successfully"));
});

const getOwnBookings = asyncHandler(async (req, res) => {
  const bookings = await counsellorService.getOwnBookings(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, bookings, "Own bookings fetched successfully"));
});

const markBookingOutcome = asyncHandler(async (req, res) => {
  const booking = await counsellorService.markBookingOutcome(
    req.user.id,
    req.params.bookingId,
    req.body.status,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, booking, "Booking outcome updated successfully"),
    );
});

const getCounsellorDashboard = asyncHandler(async (req, res) => {
  const dashboard = await counsellorService.getCounsellorDashboard(
    req.user.id,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        dashboard,
        "Counsellor dashboard analytics fetched successfully",
      ),
    );
});

export default {
  getOwnSlots,
  getOwnBookings,
  markBookingOutcome,
  getCounsellorDashboard,
};
