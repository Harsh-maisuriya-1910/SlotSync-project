import crypto from "crypto";
import ApiError from "./ApiError.js";

const encodeCursor = (slot) => {
  const raw = `${new Date(slot.startTime).toISOString()}|${slot._id.toString()}`;

  return Buffer.from(raw, "utf8").toString("base64");
};

// Decodes to a Mongo range filter on the stable composite key (startTime, _id)
const decodeCursor = (cursor) => {
  let decoded;

  try {
    decoded = Buffer.from(cursor, "base64").toString("utf8");
  } catch (error) {
    throw new ApiError(400, "Invalid pagination cursor", "INVALID_CURSOR");
  }

  const separatorIndex = decoded.indexOf("|");

  if (separatorIndex === -1) {
    throw new ApiError(400, "Invalid pagination cursor", "INVALID_CURSOR");
  }

  const startTimePart = decoded.slice(0, separatorIndex);
  const idPart = decoded.slice(separatorIndex + 1);

  const startTime = new Date(startTimePart);

  if (
    Number.isNaN(startTime.getTime()) ||
    !/^[0-9a-fA-F]{24}$/.test(idPart)
  ) {
    throw new ApiError(400, "Invalid pagination cursor", "INVALID_CURSOR");
  }

  return {
    $or: [
      { startTime: { $gt: startTime } },
      { startTime, _id: { $gt: idPart } },
    ],
  };
};

export { encodeCursor, decodeCursor };
