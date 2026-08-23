import ApiError from "../../utility/ApiError.js";

import ROLES from "../../constants/roles.js";

import authRepository from "../auth/auth.repository.js";

const createCounsellor = async (payload) => {
  const { name, email, password } = payload;

  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw new ApiError(409, "User already exists", "USER_ALREADY_EXISTS");
  }

  const counsellor = await authRepository.createUser({
    name,
    email,
    password,
    role: ROLES.COUNSELLOR,
  });

  return {
    id: counsellor._id,
    name: counsellor.name,
    email: counsellor.email,
    role: counsellor.role,
    createdAt: counsellor.createdAt,
  };
};

export default {
  createCounsellor,
};
