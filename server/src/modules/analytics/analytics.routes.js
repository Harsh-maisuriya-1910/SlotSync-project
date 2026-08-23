import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import ROLES from "../../constants/roles.js";
import analyticsController from "./analytics.controller.js";

const router = Router();

router.get(
  "/admin",
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  analyticsController.getAdminAnalytics,
);

router.get(
  "/counsellor/:id",
  authMiddleware,
  roleMiddleware(ROLES.ADMIN),
  analyticsController.getCounsellorAnalytics,
);

export default router;
