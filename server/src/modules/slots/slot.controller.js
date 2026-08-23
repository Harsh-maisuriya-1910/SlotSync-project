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
  const result = await slotService.getSlots(req.query);

  // Legacy callers (no cursor/limit params) receive the plain array
  if (Array.isArray(result)) {
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Slots fetched successfully"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "Slots fetched successfully"),
    );
});

const updateSlot = asyncHandler(async (req, res) => {
  const slot = await slotService.updateSlot(
    req.user.id,
    req.params.slotId,
    req.body,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, slot, "Slot updated successfully"));
});

export default {
  createSlot,
  getSlots,
  updateSlot,
};
