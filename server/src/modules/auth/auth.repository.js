import User from "../users/user.model.js";

const createUser = async (payload) => {
  return await User.create(payload);
};

const findUserByEmail = async (email) => {
  return await User.findOne({ email }).select("+password");
};

const findUserById = async (id) => {
  return await User.findById(id);
};

export default {
  createUser,
  findUserByEmail,
  findUserById,
};
