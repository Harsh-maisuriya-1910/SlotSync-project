import mongoose from "mongoose";
import SLOT_STATUS from "../../constants/slotStatus.js";

const slotSchema = new mongoose.Schema(
  {
    counsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    bookedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(SLOT_STATUS),
      default: SLOT_STATUS.AVAILABLE,
    },

    // Optimistic concurrency control: incremented on every mutation
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

slotSchema.index({
  counsellor: 1,
  startTime: 1,
  endTime: 1,
});

const Slot = mongoose.model("Slot", slotSchema);

export default Slot;
