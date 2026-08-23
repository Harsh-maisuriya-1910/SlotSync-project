import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import ROLES from "../../constants/roles.js";
import auditController from "./audit.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(ROLES.ADMIN));

router.get("/", auditController.getAuditLogs);

export default router;
