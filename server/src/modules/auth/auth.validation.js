import Joi from "joi";

const registerValidation = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Name is required",
  }),

  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),

  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Password must be at least 8 characters",
    "string.max": "Password cannot exceed 128 characters",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),

  // Public users cannot choose role
  role: Joi.forbidden(),
});

const loginValidation = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),

  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

const refreshValidation = Joi.object({
  refreshToken: Joi.string().allow("").optional().messages({
    "string.base": "Refresh token must be a string",
  }),
});

export { registerValidation, loginValidation, refreshValidation };
