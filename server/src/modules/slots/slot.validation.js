import Joi from "joi";

const createSlotValidation = Joi.object({
  startTime: Joi.date().required().messages({
    "date.base": "Start time must be a valid date",
    "any.required": "Start time is required",
  }),

  endTime: Joi.date().required().messages({
    "date.base": "End time must be a valid date",
    "any.required": "End time is required",
  }),

  capacity: Joi.number().integer().min(1).required().messages({
    "number.base": "Capacity must be a number",
    "number.min": "Capacity must be at least 1",
    "any.required": "Capacity is required",
  }),
})
  .custom((value, helpers) => {
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .messages({
    "any.invalid": "End time must be greater than start time",
  });

// Optimistic concurrency: client echoes back the version it read
const updateSlotValidation = Joi.object({
  expectedVersion: Joi.number().integer().min(0).required().messages({
    "number.base": "expectedVersion must be a number",
    "number.min": "expectedVersion must be at least 0",
    "any.required": "expectedVersion is required",
  }),

  startTime: Joi.date().optional(),

  endTime: Joi.date().optional(),

  capacity: Joi.number().integer().min(1).optional(),
});

const listSlotsValidation = Joi.object({
  cursor: Joi.string().allow("").optional(),

  limit: Joi.number().integer().min(1).max(100).optional(),
});

export {
  createSlotValidation,
  updateSlotValidation,
  listSlotsValidation,
};
