import ApiError from "../../utility/ApiError.js";
import SLOT_STATUS from "../../constants/slotStatus.js";
import slotRepository from "./slot.repository.js";
import auditService from "../audit/audit.service.js";
import AUDIT_ACTIONS from "../../constants/auditActions.js";

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

  return {
    id: slot._id,
    counsellor: slot.counsellor,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
    status: slot.status,
    createdAt: slot.createdAt,
  };
};

const getSlots = async () => {
  const slots = await slotRepository.findSlots();

  return slots.map((slot) => ({
    id: slot._id,
    counsellor: slot.counsellor,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
    status: slot.status,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  }));
};

export default {
  createSlot,
  getSlots,
};
