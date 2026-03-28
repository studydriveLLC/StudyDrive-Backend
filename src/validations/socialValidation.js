const { z } = require('zod');

const createPostSchema = z.object({
  body: z.object({
    text: z.string().max(3000, "Le texte ne peut pas depasser 3000 caracteres").optional(),
    textBackground: z.string().optional(),
    mediaUrls: z.array(z.string().url("URL de media invalide")).optional(),
    mediaType: z.enum(['image', 'video', 'none']).default('none'),
    isRepost: z.boolean().optional(),
    originalPost: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID de post invalide").optional()
  }).refine(data => data.text || (data.mediaUrls && data.mediaUrls.length > 0) || data.isRepost, {
    message: "Une publication doit contenir au moins du texte, un media, ou etre un repost."
  }).strict()
});

const targetUserSchema = z.object({
  params: z.object({
    targetId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID d'utilisateur invalide")
  })
});

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
  validate
};