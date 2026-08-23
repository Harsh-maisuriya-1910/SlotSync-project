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

const countWaitingEntriesForSlot = async (slotId, session = null) => {
  return await Waitlist.countDocuments(
    {
      slot: slotId,
      status: WAITLIST_STATUS.WAITING,
    },
    { session },
  );
};

const findFirstWaitingEntry = async (slotId, session = null) => {
  return await Waitlist.findOne({
    slot: slotId,
    status: WAITLIST_STATUS.WAITING,
  })
    .sort({ queuePosition: 1 })
    .session(session);
};

const updateWaitlistEntryStatus = async (entryId, status, session = null) => {
  const updateData = { status };
  if (status === WAITLIST_STATUS.PROMOTED) {
    updateData.promotedAt = new Date();
  }

  return await Waitlist.findByIdAndUpdate(entryId, updateData, {
    new: true,
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
  countWaitingEntriesForSlot,
  findFirstWaitingEntry,
  updateWaitlistEntryStatus,
  findWaitlistByStudent,
};
