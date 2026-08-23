import mongoose from "mongoose";
import WAITLIST_STATUS from "../../constants/waitlistStatus.js";

const waitlistSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
    },

    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      required: [true, "Slot reference is required"],
    },

    status: {
      type: String,
      enum: Object.values(WAITLIST_STATUS),
      default: WAITLIST_STATUS.WAITING,
      required: true,
    },

    queuePosition: {
      type: Number,
      required: [true, "Queue position is required"],
    },

    promotedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound unique index ensuring a student can only be actively waitlisted once per slot
waitlistSchema.index(
  { student: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: WAITLIST_STATUS.WAITING },
  },
);

// Compound index to quickly fetch the next student in the queue
waitlistSchema.index({ slot: 1, status: 1, queuePosition: 1 });

const Waitlist = mongoose.model("Waitlist", waitlistSchema);

export default Waitlist;
