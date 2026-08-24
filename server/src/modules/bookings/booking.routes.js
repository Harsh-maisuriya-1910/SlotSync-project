import express from "express";

import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validationMiddleware from "../../middleware/validation.middleware.js";

import ROLES from "../../constants/roles.js";

import bookingController from "./booking.controller.js";
import { createBookingValidation } from "./booking.validation.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(ROLES.STUDENT),
  validationMiddleware(createBookingValidation),
  bookingController.createBooking,
);

router.patch(
  "/:bookingId/cancel",
  authMiddleware,
  roleMiddleware(ROLES.STUDENT),
  bookingController.cancelBooking,
);

router.delete(
  "/:bookingId",
  authMiddleware,
  roleMiddleware(ROLES.STUDENT),
  bookingController.cancelBooking,
);

router.get(
  "/my-bookings",
  authMiddleware,
  roleMiddleware(ROLES.STUDENT),
  bookingController.getMyBookings,
);

export default router;
