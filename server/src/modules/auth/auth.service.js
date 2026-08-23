import ApiError from "../../utility/ApiError.js";
import authRepository from "./auth.repository.js";
import { generateAccessToken } from "../../utility/jwt.js";

const registerUser = async (payload) => {
  const normalizedEmail = payload.email.toLowerCase().trim();

  const existingUser = await authRepository.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new ApiError(
      409,
      "User already exists with this email",
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const user = await authRepository.createUser({
    ...payload,
    email: normalizedEmail,
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await authRepository.findUserByEmail(normalizedEmail);

  if (!user) {
    throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const accessToken = generateAccessToken({
    id: user._id,
    role: user.role,
  });

  return {
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};

const logoutUser = async () => {
  return {
    message: "Logout successful",
  };
};

const getCurrentUser = async (userId) => {
  const user = await authRepository.findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export default {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
};
