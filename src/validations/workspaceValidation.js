const { z } = require('zod');

const autoSaveSchema = z.object({
  body: z.object({
    title: z.string().max(100).optional(),
    content: z.string().optional(),
    status: z.enum(['draft', 'ready']).optional(),
  }).strict(),
  params: z.object({
    documentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID de document invalide"),
  })
});

const createResourceSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(150),
    description: z.string().max(500).optional(),
    major: z.string().min(2),
  })
});

// Le middleware de validation manquant
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    const errors = error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    
    return res.status(400).json({
      status: 'fail',
      message: 'Erreur de validation des donnees',
      errors,
    });
  }
};

module.exports = {
  autoSaveSchema,
  createResourceSchema,
  validate // Exportation ajoutee
};