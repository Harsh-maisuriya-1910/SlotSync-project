import express from "express";

import authController from "./auth.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import validate from "../../middleware/validation.middleware.js";
import {
  registerValidation,
  loginValidation,
  refreshValidation,
} from "./auth.validation.js";

const router = express.Router();

/* Public Routes */

router.post("/register", validate(registerValidation), authController.register);
router.post("/login", validate(loginValidation), authController.login);
router.post("/refresh", validate(refreshValidation), authController.refresh);

/* Protected Routes */

router.post("/logout", authMiddleware, authController.logout);
router.get("/me", authMiddleware, authController.getMe);

export default router;
