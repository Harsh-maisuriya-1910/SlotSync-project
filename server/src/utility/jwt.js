import jwt from "jsonwebtoken";
import env from "../config/env.js";

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};
