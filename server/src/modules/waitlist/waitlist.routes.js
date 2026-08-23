import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validationMiddleware from "../../middleware/validation.middleware.js";
import ROLES from "../../constants/roles.js";
import waitlistController from "./waitlist.controller.js";
import { joinWaitlistValidation } from "./waitlist.validation.js";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(ROLES.STUDENT));

router.post(
  "/",
  validationMiddleware(joinWaitlistValidation),
  waitlistController.joinWaitlist,
);

router.get("/my-waitlist", waitlistController.getOwnWaitlist);

export default router;
