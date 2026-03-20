const { z } = require('zod');

const createResourceSchema = z.object({
  body: z.object({
    title: z.string().min(3, "Le titre doit contenir au moins 3 caractères").max(100),
    category: z.string().min(2, "La catégorie est requise"),
    level: z.string().min(2, "Le niveau est requis"),
  }).strict(),
});

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;
    
    next();
  } catch (error) {
    const errors = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    
    return res.status(400).json({
      status: 'fail',
      message: 'Erreur de validation des données',
      errors,
    });
  }
};

module.exports = {
  createResourceSchema,
  validate,
};