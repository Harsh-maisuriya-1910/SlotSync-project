import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import slotService from "./slot.service.js";

const createSlot = asyncHandler(async (req, res) => {
  const slot = await slotService.createSlot(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, slot, "Slot created successfully"));
});

const getSlots = asyncHandler(async (req, res) => {
  const slots = await slotService.getSlots();

  return res
    .status(200)
    .json(new ApiResponse(200, slots, "Slots fetched successfully"));
});

export default {
  createSlot,
  getSlots,
};
