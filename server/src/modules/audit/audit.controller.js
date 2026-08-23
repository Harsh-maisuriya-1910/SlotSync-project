import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import auditService from "./audit.service.js";

const getAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditService.getAuditLogs(req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Audit logs retrieved successfully"));
});

export default {
  getAuditLogs,
};
