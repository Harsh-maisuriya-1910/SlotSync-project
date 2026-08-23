import mongoose from "mongoose";

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    statusCode: {
      type: Number,
      default: 201,
    },

    // Serialized booking response replayed verbatim for duplicate requests
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

idempotencyRecordSchema.index({ student: 1, key: 1 }, { unique: true });

const IdempotencyRecord = mongoose.model(
  "IdempotencyRecord",
  idempotencyRecordSchema,
);

export default IdempotencyRecord;
