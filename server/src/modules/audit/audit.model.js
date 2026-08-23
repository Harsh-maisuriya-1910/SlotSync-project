import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    action: {
      type: String,
      required: [true, "Action is required"],
    },

    entity: {
      type: String,
      required: [true, "Entity type is required"],
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Entity ID is required"],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Indexes for query support, performance, and sorting
auditSchema.index({ action: 1 });
auditSchema.index({ entity: 1 });
auditSchema.index({ createdAt: -1 });

const Audit = mongoose.model("Audit", auditSchema);

export default Audit;
