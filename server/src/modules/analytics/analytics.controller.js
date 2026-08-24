import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import analyticsService from "./analytics.service.js";

const getAdminAnalytics = asyncHandler(async (req, res) => {
  const stats = await analyticsService.getAdminAnalytics();

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Admin analytics fetched successfully"));
});

import ApiError from "../../utility/ApiError.js";
import ROLES from "../../constants/roles.js";

const getCounsellorAnalytics = asyncHandler(async (req, res) => {
  // If user is a counsellor, verify they are only requesting their own analytics
  if (req.user.role === ROLES.COUNSELLOR && req.user.id !== req.params.id) {
    throw new ApiError(403, "Access forbidden", "ACCESS_FORBIDDEN");
  }

  const stats = await analyticsService.getCounsellorAnalytics(req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Counsellor analytics fetched successfully"));
});

export default {
  getAdminAnalytics,
  getCounsellorAnalytics,
};
