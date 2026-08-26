import Waitlist from "./waitlist.model.js";
import WAITLIST_STATUS from "../../constants/waitlistStatus.js";

const addToWaitlist = async (payload, session = null) => {
  const entry = await Waitlist.create([payload], { session });
  return entry[0];
};

const findActiveWaitlistEntry = async (studentId, slotId, session = null) => {
  return await Waitlist.findOne({
    student: studentId,
    slot: slotId,
    status: WAITLIST_STATUS.WAITING,
  }).session(session);
};

const getMaxQueuePositionForSlot = async (slotId, session = null) => {
  const maxEntry = await Waitlist.findOne({ slot: slotId })
    .sort({ queuePosition: -1 })
    .session(session);
  return maxEntry ? maxEntry.queuePosition : 0;
};

const popFirstWaitingEntry = async (slotId, session = null) => {
  return await Waitlist.findOneAndUpdate(
    {
      slot: slotId,
      status: WAITLIST_STATUS.WAITING,
    },
    {
      status: WAITLIST_STATUS.PROMOTED,
      promotedAt: new Date(),
    },
    {
      sort: { queuePosition: 1 },
      returnDocument: "after",
      session,
    }
  );
};

const updateWaitlistEntryStatus = async (entryId, status, session = null) => {
  const updateData = { status };
  if (status === WAITLIST_STATUS.PROMOTED) {
    updateData.promotedAt = new Date();
  }

  return await Waitlist.findByIdAndUpdate(entryId, updateData, {
    returnDocument: "after",
    session,
  });
};

const findWaitlistByStudent = async (studentId) => {
  return await Waitlist.find({ student: studentId })
    .populate({
      path: "slot",
      populate: {
        path: "counsellor",
        select: "name email",
      },
    })
    .sort({ createdAt: -1 });
};

export default {
  addToWaitlist,
  findActiveWaitlistEntry,
  getMaxQueuePositionForSlot,
  popFirstWaitingEntry,
  updateWaitlistEntryStatus,
  findWaitlistByStudent,
};
