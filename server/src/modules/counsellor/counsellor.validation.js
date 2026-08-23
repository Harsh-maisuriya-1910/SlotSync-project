import Joi from "joi";
import BOOKING_STATUS from "../../constants/bookingStatus.js";

const updateOutcomeValidation = Joi.object({
  status: Joi.string()
    .valid(BOOKING_STATUS.ATTENDED, BOOKING_STATUS.NO_SHOW)
    .required()
    .messages({
      "any.only": "Status must be ATTENDED or NO_SHOW",
      "any.required": "Status is required",
    }),
});

export { updateOutcomeValidation };
