import ApiResponse from "../../utility/ApiResponse.js";
import asyncHandler from "../../utility/asyncHandler.js";

import userService from "./user.service.js";

const createCounsellor = asyncHandler(async (req, res) => {
  const counsellor = await userService.createCounsellor(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, counsellor, "Counsellor created successfully"));
});

export default {
  createCounsellor,
};
