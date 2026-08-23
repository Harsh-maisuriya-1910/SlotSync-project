import ApiError from "../../utility/ApiError.js";
import authRepository from "./auth.repository.js";
import { generateAccessToken } from "../../utility/jwt.js";
import {
  generateOpaqueToken,
  hashToken,
  generateFamilyId,
} from "../../utility/tokens.js";
import RefreshSession from "./refreshSession.model.js";
import env from "../../config/env.js";

const REFRESH_TOKEN_TTL_DAYS = Number(env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;

const issueRefreshSession = async (userId) => {
  const token = generateOpaqueToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await RefreshSession.create({
    user: userId,
    familyId: generateFamilyId(),
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
};

const rotateRefreshSession = async ({ session, userId }) => {
  const newToken = generateOpaqueToken();
  const newHash = hashToken(newToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await RefreshSession.create({
    user: userId,
    familyId: session.familyId,
    tokenHash: newHash,
    expiresAt,
  });

  session.usedAt = new Date();
  session.replacedByHash = newHash;
  await session.save();

  return { token: newToken, expiresAt };
};

const revokeFamily = async (familyId) => {
  await RefreshSession.updateMany({
    familyId,
    revokedAt: null,
  }, {
    revokedAt: new Date(),
  });
};

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

  const refresh = await issueRefreshSession(user._id);

  return {
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};

const refreshTokens = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    throw new ApiError(
      401,
      "Refresh token is required",
      "MISSING_REFRESH_TOKEN",
    );
  }

  const tokenHash = hashToken(rawRefreshToken);

  const session = await RefreshSession.findOne({ tokenHash });

  if (!session) {
    throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  if (session.revokedAt) {
    throw new ApiError(
      401,
      "Refresh token chain has been revoked",
      "REFRESH_TOKEN_REVOKED",
    );
  }

  if (session.expiresAt <= new Date()) {
    await revokeFamily(session.familyId);

    throw new ApiError(401, "Refresh token expired", "REFRESH_TOKEN_EXPIRED");
  }

  // Token was already rotated once: a second presentation means the chain
  // leaked. Revoke every descendant so stolen tokens become unusable.
  if (session.usedAt) {
    await revokeFamily(session.familyId);

    throw new ApiError(
      401,
      "Refresh token reuse detected; token family revoked",
      "REFRESH_REUSE_DETECTED",
    );
  }

  const user = await authRepository.findUserById(session.user);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const refreshed = await rotateRefreshSession({
    session,
    userId: user._id,
  });

  const accessToken = generateAccessToken({
    id: user._id,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken: refreshed.token,
    refreshTokenExpiresAt: refreshed.expiresAt,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
};

const logoutUser = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    const session = await RefreshSession.findOne({
      tokenHash: hashToken(rawRefreshToken),
    });

    if (session) {
      // Logging out invalidates the whole chain, not just this leaf
      await revokeFamily(session.familyId);
    }
  }

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
  refreshTokens,
  logoutUser,
  getCurrentUser,
};
