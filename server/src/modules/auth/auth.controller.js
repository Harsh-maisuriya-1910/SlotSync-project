import authService from "./auth.service.js";
import asyncHandler from "../../utility/asyncHandler.js";
import ApiResponse from "../../utility/ApiResponse.js";

const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, user, "User registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.loginUser(req.body);

  return res.status(200).json(new ApiResponse(200, data, "Login successful"));
});

const logout = asyncHandler(async (req, res) => {
  const data = await authService.logoutUser();

  return res.status(200).json(new ApiResponse(200, data, "Logout successful"));
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});

export default {
  register,
  login,
  logout,
  getMe,
};
