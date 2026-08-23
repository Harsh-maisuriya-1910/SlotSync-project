const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    if (source === "query") {
      // Express 5 exposes req.query as a getter-only property
      Object.keys(req.query).forEach((key) => delete req.query[key]);
      Object.assign(req.query, value);
    } else {
      req[source] = value;
    }

    next();
  };
};

export default validate;
