import ApiError from "../../utility/ApiError.js";
import SLOT_STATUS from "../../constants/slotStatus.js";
import slotRepository from "./slot.repository.js";
import auditService from "../audit/audit.service.js";
import AUDIT_ACTIONS from "../../constants/auditActions.js";
import { decodeCursor, encodeCursor } from "../../utility/cursorPagination.js";
import { emitGlobalSlotCreated, emitSlotUpdate } from "../../socket.js";

const serializeSlot = (slot) => ({
  id: slot._id,
  counsellor: slot.counsellor,
  startTime: slot.startTime,
  endTime: slot.endTime,
  capacity: slot.capacity,
  bookedCount: slot.bookedCount,
  status: slot.status,
  version: slot.version,
  createdAt: slot.createdAt,
  updatedAt: slot.updatedAt,
});

const createSlot = async (counsellorId, payload) => {
  const { startTime, endTime, capacity } = payload;

  const overlappingSlot = await slotRepository.findCounsellorOverlappingSlot(
    counsellorId,
    startTime,
    endTime,
  );

  if (overlappingSlot) {
    throw new ApiError(
      409,
      "Slot overlaps with an existing slot",
      "SLOT_OVERLAP",
    );
  }

  const slot = await slotRepository.createSlot({
    counsellor: counsellorId,
    startTime,
    endTime,
    capacity,
    bookedCount: 0,
    status: SLOT_STATUS.AVAILABLE,
  });

  await auditService.logEvent({
    user: counsellorId,
    action: AUDIT_ACTIONS.SLOT_CREATED,
    entity: "SLOT",
    entityId: slot._id,
    metadata: {
      capacity: slot.capacity,
      startTime: slot.startTime,
      endTime: slot.endTime,
    },
  });

  emitGlobalSlotCreated({ action: "slot_created", slotId: slot._id });

  return {
    id: slot._id,
    counsellor: slot.counsellor,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
    status: slot.status,
    version: slot.version,
    createdAt: slot.createdAt,
  };
};

const getSlots = async (queryParams = {}) => {
  const { cursor, limit } = queryParams;

  // Legacy behavior: full ascending list for callers that do not paginate
  if (cursor === undefined && limit === undefined) {
    const slots = await slotRepository.findSlots();

    return slots.map(serializeSlot);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  let filter = {};
  if (cursor) {
    filter = { ...decodeCursor(cursor) };
  }

  const fetched = await slotRepository.findSlotsWithCursor(
    filter,
    parsedLimit + 1,
  );

  const hasMore = fetched.length > parsedLimit;
  const slots = hasMore ? fetched.slice(0, parsedLimit) : fetched;

  const nextCursor = hasMore
    ? encodeCursor(slots[slots.length - 1])
    : null;

  return {
    slots: slots.map(serializeSlot),
    pagination: {
      limit: parsedLimit,
      count: slots.length,
      hasMore,
      nextCursor,
    },
  };
};

const updateSlot = async (counsellorId, slotId, payload) => {
  const { expectedVersion, startTime, endTime, capacity } = payload;

  const existingSlot = await slotRepository.findSlotById(slotId);

  if (!existingSlot) {
    throw new ApiError(404, "Slot not found", "SLOT_NOT_FOUND");
  }

  if (existingSlot.counsellor.toString() !== String(counsellorId)) {
    throw new ApiError(
      403,
      "You are not allowed to modify this slot",
      "ACCESS_FORBIDDEN",
    );
  }

  const nextStartTime = startTime || existingSlot.startTime;
  const nextEndTime = endTime || existingSlot.endTime;

  if (startTime || endTime) {
    if (new Date(nextEndTime) <= new Date(nextStartTime)) {
      throw new ApiError(
        422,
        "End time must be greater than start time",
        "VALIDATION_ERROR",
      );
    }

    const overlappingSlot =
      await slotRepository.findCounsellorOverlappingSlotExcluding(
        counsellorId,
        nextStartTime,
        nextEndTime,
        slotId,
      );

    if (overlappingSlot) {
      throw new ApiError(
        409,
        "Slot overlaps with an existing slot",
        "SLOT_OVERLAP",
      );
    }
  }

  const updateSet = {};
  if (capacity !== undefined) {
    updateSet.capacity = capacity;
  }
  if (startTime) {
    updateSet.startTime = startTime;
  }
  if (endTime) {
    updateSet.endTime = endTime;
  }

  const updatedSlot = await slotRepository.updateSlotWithVersion(
    slotId,
    expectedVersion,
    updateSet,
  );

  if (!updatedSlot) {
    throw new ApiError(
      409,
      "Slot was modified by another request; reload and retry",
      "SLOT_VERSION_CONFLICT",
    );
  }

  await auditService.logEvent({
    user: counsellorId,
    action: AUDIT_ACTIONS.SLOT_UPDATED,
    entity: "SLOT",
    entityId: updatedSlot._id,
    metadata: { expectedVersion, updateSet },
  });

  emitSlotUpdate(slotId, { action: "slot_updated" });

  return serializeSlot(updatedSlot);
};

export default {
  createSlot,
  getSlots,
  updateSlot,
};
