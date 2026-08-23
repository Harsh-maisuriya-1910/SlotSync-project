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

// --- Append-only enforcement -------------------------------------------
// Audit records are immutable evidence: every mutation or deletion path
// is rejected at the model layer so no caller can silently rewrite history.

const APPEND_ONLY_ERROR =
  "Audit log is append-only: modifications and deletions are not allowed";

const rejectAppendOnlyOperation = function () {
  throw new Error(APPEND_ONLY_ERROR);
};

[
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "findOneAndRemove",
].forEach((op) => {
  auditSchema.pre(op, rejectAppendOnlyOperation);
});

auditSchema.pre("deleteMany", { document: false, query: true }, rejectAppendOnlyOperation);
auditSchema.pre("deleteMany", { document: true, query: false }, rejectAppendOnlyOperation);
auditSchema.pre("deleteOne", { document: false, query: true }, rejectAppendOnlyOperation);
auditSchema.pre("deleteOne", { document: true, query: false }, rejectAppendOnlyOperation);

// save() on a persisted document would also mutate history
auditSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error(APPEND_ONLY_ERROR);
  }
});

// ------------------------------------------------------------------------

// Indexes for query support, performance, and sorting
auditSchema.index({ action: 1 });
auditSchema.index({ entity: 1 });
auditSchema.index({ createdAt: -1 });

const Audit = mongoose.model("Audit", auditSchema);

export default Audit;
