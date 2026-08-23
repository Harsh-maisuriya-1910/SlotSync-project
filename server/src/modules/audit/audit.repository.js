import Audit from "./audit.model.js";

const createAuditLog = async (payload, session = null) => {
  const log = await Audit.create([payload], { session });
  return log[0];
};

const findAuditLogs = async ({ filter, skip, limit, sort }) => {
  return await Audit.find(filter)
    .populate("user", "name email role")
    .skip(skip)
    .limit(limit)
    .sort(sort);
};

const countAuditLogs = async (filter) => {
  return await Audit.countDocuments(filter);
};

export default {
  createAuditLog,
  findAuditLogs,
  countAuditLogs,
};
