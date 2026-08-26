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

// Cursor pagination: stable composite ordering (startTime, _id), no skip()
const findSlotsWithCursor = async (filter, limit) => {
  return await Slot.find(filter)
    .sort({
      startTime: 1,
      _id: 1,
    })
    .limit(limit);
};

const findCounsellorOverlappingSlotExcluding = async (
  counsellorId,
  startTime,
  endTime,
  excludeSlotId,
) => {
  return await Slot.findOne({
    _id: { $ne: excludeSlotId },
    counsellor: counsellorId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
};

// Returns null when expectedVersion is stale (another write won the race)
const updateSlotWithVersion = async (slotId, expectedVersion, updateSet) => {
  return await Slot.findOneAndUpdate(
    {
      _id: slotId,
      version: expectedVersion,
    },
    {
      $set: updateSet,
      $inc: {
        version: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );
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
        version: 1,
      },
    },
    {
      returnDocument: "after",
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
        version: 1,
      },
    },
    {
      returnDocument: "after",
      session,
    },
  );
};

export default {
  createSlot,
  findSlotById,
  findCounsellorOverlappingSlot,
  findCounsellorOverlappingSlotExcluding,
  updateSlotWithVersion,
  findSlots,
  findSlotsWithCursor,
  reserveSeat,
  releaseSeat,
};
