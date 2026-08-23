import mongoose from "mongoose";

import BOOKING_STATUS from "../../constants/bookingStatus.js";

const bookingSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.BOOKED,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

bookingSchema.index(
  {
    student: 1,
    slot: 1,
  },
  {
    unique: true,
  },
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
