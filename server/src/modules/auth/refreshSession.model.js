import mongoose from "mongoose";

const refreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // All rotations belong to one login chain; a stolen token revokes the family
    familyId: {
      type: String,
      required: true,
      index: true,
    },

    // sha256 of the opaque token; raw token never touches the database
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    replacedByHash: {
      type: String,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Opportunistic cleanup of expired sessions
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshSession = mongoose.model("RefreshSession", refreshSessionSchema);

export default RefreshSession;
