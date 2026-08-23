import Slot from "./slot.model.js";

const createSlot = async (payload) => {
  return await Slot.create(payload);
};

const findSlotById = async (slotId) => {
  return await Slot.findById(slotId);
};

const findCounsellorOverlappingSlot = async (
  counsellorId,
  startTime,
  endTime,
) => {
  return await Slot.findOne({
    counsellor: counsellorId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
};

const findSlots = async () => {
  return await Slot.find().sort({
    startTime: 1,
  });
};

const reserveSeat = async (slotId, session = null) => {
  return await Slot.findOneAndUpdate(
    {
      _id: slotId,
      $expr: {
        $lt: ["$bookedCount", "$capacity"],
      },
    },
    {
      $inc: {
        bookedCount: 1,
      },
    },
    {
      new: true,
      session,
    },
  );
};

const releaseSeat = async (slotId, session = null) => {
  return await Slot.findOneAndUpdate(
    {
      _id: slotId,
      bookedCount: { $gt: 0 },
    },
    {
      $inc: {
        bookedCount: -1,
      },
    },
    {
      new: true,
      session,
    },
  );
};

export default {
  createSlot,
  findSlotById,
  findCounsellorOverlappingSlot,
  findSlots,
  reserveSeat,
  releaseSeat,
};
