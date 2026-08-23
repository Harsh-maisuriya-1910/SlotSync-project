import Joi from "joi";

const joinWaitlistValidation = Joi.object({
  slotId: Joi.string().required().messages({
    "string.base": "Slot id must be a string",
    "any.required": "Slot id is required",
  }),
});

export { joinWaitlistValidation };
