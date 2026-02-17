/**
 * Express middleware for Zod request body validation
 */

/**
 * Returns middleware that validates req.body against the given Zod schema.
 * On success, replaces req.body with the parsed (and defaulted) value.
 * On failure, returns 400 with structured error details.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
