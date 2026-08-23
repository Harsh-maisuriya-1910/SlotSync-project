import { Router } from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validationMiddleware from "../../middleware/validation.middleware.js";

import ROLES from "../../constants/roles.js";

import userController from "./user.controller.js";
import { createCounsellorValidation } from "./user.validation.js";

const router = Router();

router.post(
  "/counsellors",
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  validationMiddleware(createCounsellorValidation),
  userController.createCounsellor,
);

export default router;
