import User from "../modules/users/user.model.js";
import { verifyAccessToken } from "../utility/jwt.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "UNAUTHENTICATED",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id).select("_id name email role");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
};

export default authMiddleware;
