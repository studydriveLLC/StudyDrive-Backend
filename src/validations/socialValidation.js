const { z } = require('zod');

const createPostSchema = z.object({
  body: z.object({
    text: z.string().max(3000, "Le texte ne peut pas depasser 3000 caracteres").optional(),
    mediaUrls: z.array(z.string().url("URL de media invalide")).optional(),
    mediaType: z.enum(['image', 'video', 'none']).default('none'),
  }).refine(data => data.text || (data.mediaUrls && data.mediaUrls.length > 0), {
    message: "Une publication doit contenir au moins du texte ou un media."
  }).strict()
});

const targetUserSchema = z.object({
  params: z.object({
    targetId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID d'utilisateur invalide")
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
  createPostSchema,
  targetUserSchema,
  validate // Exportation ajoutee
};