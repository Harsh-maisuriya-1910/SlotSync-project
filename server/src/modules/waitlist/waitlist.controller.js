import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import waitlistService from "./waitlist.service.js";

const joinWaitlist = asyncHandler(async (req, res) => {
  const entry = await waitlistService.joinWaitlist(req.user.id, req.body.slotId);

  return res
    .status(201)
    .json(new ApiResponse(201, entry, "Successfully joined waitlist"));
});

const getOwnWaitlist = asyncHandler(async (req, res) => {
  const waitlist = await waitlistService.getOwnWaitlist(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, waitlist, "Waitlist entries fetched successfully"));
});

export default {
  joinWaitlist,
  getOwnWaitlist,
};
