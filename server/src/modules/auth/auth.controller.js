import authService from "./auth.service.js";
import asyncHandler from "../../utility/asyncHandler.js";
import ApiResponse from "../../utility/ApiResponse.js";
import env from "../../config/env.js";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: REFRESH_COOKIE_PATH,
  maxAge:
    (Number(env.REFRESH_TOKEN_EXPIRES_DAYS) || 7) * 24 * 60 * 60 * 1000,
});

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
  });
};

const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, user, "User registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.loginUser(req.body);

  // Cookie for browser clients; token stays in the body for non-browser ones
  res.cookie(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());

  return res.status(200).json(new ApiResponse(200, data, "Login successful"));
});

const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;

  const data = await authService.refreshTokens(rawToken);

  res.cookie(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Token refreshed successfully"));
});

const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;

  const data = await authService.logoutUser(rawToken);

  clearRefreshCookie(res);

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
  refresh,
  logout,
  getMe,
};
