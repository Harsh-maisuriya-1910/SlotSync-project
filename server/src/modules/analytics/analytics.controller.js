import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";
import analyticsService from "./analytics.service.js";

const getAdminAnalytics = asyncHandler(async (req, res) => {
  const stats = await analyticsService.getAdminAnalytics();

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Admin analytics fetched successfully"));
});

export default {
  getAdminAnalytics,
};
