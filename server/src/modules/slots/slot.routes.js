import express from "express";

import slotController from "./slot.controller.js";

import authMiddleware from "../../middleware/auth.middleware.js";
import roleMiddleware from "../../middleware/role.middleware.js";
import validate from "../../middleware/validation.middleware.js";

import ROLES from "../../constants/roles.js";

import { createSlotValidation } from "./slot.validation.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware(ROLES.COUNSELLOR),
  validate(createSlotValidation),
  slotController.createSlot,
);

router.get("/", authMiddleware, slotController.getSlots);

export default router;
