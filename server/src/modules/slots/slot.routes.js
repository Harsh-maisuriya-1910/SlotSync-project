import express from "express";

import slotController from "./slot.controller.js";

import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validate from "../../middleware/validation.middleware.js";

import ROLES from "../../constants/roles.js";

import {
  createSlotValidation,
  updateSlotValidation,
  listSlotsValidation,
} from "./slot.validation.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(ROLES.COUNSELLOR),
  validate(createSlotValidation),
  slotController.createSlot,
);

router.get("/", authMiddleware, validate(listSlotsValidation, "query"), slotController.getSlots);

router.patch(
  "/:slotId",
  authMiddleware,
  roleMiddleware(ROLES.COUNSELLOR),
  validate(updateSlotValidation),
  slotController.updateSlot,
);

export default router;
