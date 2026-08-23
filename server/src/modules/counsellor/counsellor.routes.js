import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validationMiddleware from "../../middleware/validation.middleware.js";
import ROLES from "../../constants/roles.js";
import counsellorController from "./counsellor.controller.js";
import { updateOutcomeValidation } from "./counsellor.validation.js";

const router = Router();

// Apply auth and role verification to all counsellor routes
router.use(authMiddleware);
router.use(roleMiddleware(ROLES.COUNSELLOR));

router.get("/slots", counsellorController.getOwnSlots);
router.get("/bookings", counsellorController.getOwnBookings);
router.patch(
  "/bookings/:bookingId/outcome",
  validationMiddleware(updateOutcomeValidation),
  counsellorController.markBookingOutcome,
);
router.get("/dashboard", counsellorController.getCounsellorDashboard);

export default router;
