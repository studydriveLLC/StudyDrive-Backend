// src/services/resourceService.js
const Resource = require('../models/Resource');
const AppError = require('../utils/AppError');
const redisClient = require('../config/redis');

const invalidateFeedCache = async () => {
  try {
    const keys = await redisClient.keys('resources:feed:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Erreur lors de l invalidation du cache feed:', err);
  }
};

exports.getAllResources = async (query) => {
  const { search, category, level, sort, page = 1, limit = 10 } = query;
  const cacheKey = `resources:feed:${search || 'all'}:${category || 'all'}:${level || 'all'}:${sort || 'new'}:${page}:${limit}`;

  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {}

  const filter = { status: 'ready' };
  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;
  if (level) filter.level = level;

  const skip = (page - 1) * limit;
  let queryBuilder = Resource.find(filter).populate('uploadedBy', 'pseudo avatar').skip(skip).limit(limit);

  if (sort === 'popular') {
    queryBuilder = queryBuilder.sort({ downloads: -1, views: -1 });
  } else {
    queryBuilder = queryBuilder.sort({ createdAt: -1 });
  }

  const [resources, total] = await Promise.all([
    queryBuilder,
    Resource.countDocuments(filter)
  ]);

  const result = { resources, total, page: Number(page), pages: Math.ceil(total / limit) };

  try {
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 60);
  } catch (err) {}

  return result;
};

// NOUVEAU : Récupération des ressources de l'utilisateur pour son profil (Temps réel, pas de cache agressif)
exports.getMyResources = async (userId) => {
  const resources = await Resource.find({ uploadedBy: userId })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'pseudo avatar');
  return resources;
};

exports.getResourceById = async (id) => {
  const cacheKey = `resource:detail:${id}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {}

  const resource = await Resource.findById(id).populate('uploadedBy', 'pseudo avatar');
  if (!resource) throw new AppError('Ressource non trouvee.', 404);
  if (resource.status !== 'ready') throw new AppError('Cette ressource est en cours de traitement, elle sera disponible dans quelques instants.', 202);

  try {
    await redisClient.set(cacheKey, JSON.stringify(resource), 'EX', 120);
  } catch (err) {}

  return resource;
};

exports.trackView = async (id) => {
  const resource = await Resource.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true, runValidators: true });
  if (!resource) throw new AppError('Ressource non trouvee.', 404);
  try {
     await redisClient.del(`resource:detail:${id}`);
     await invalidateFeedCache();
  } catch (err) {}
  return resource;
};

exports.trackDownload = async (id) => {
  const resource = await Resource.findByIdAndUpdate(id, { $inc: { downloads: 1 } }, { new: true, runValidators: true });
  if (!resource) throw new AppError('Ressource non trouvee.', 404);
  try {
     await redisClient.del(`resource:detail:${id}`);
     await invalidateFeedCache();
  } catch (err) {}
  return resource;
};

exports.createResource = async (resourceData) => {
  const resource = await Resource.create(resourceData);
  await invalidateFeedCache();
  return resource;
};

// NOUVEAU : Logique de modification sécurisée et centralisée
exports.updateResource = async (id, userId, userRole, updateData) => {
  const resource = await Resource.findById(id);
  if (!resource) throw new AppError('Document introuvable.', 404);

  if (resource.uploadedBy.toString() !== userId.toString() && userRole !== 'admin' && userRole !== 'superadmin') {
    throw new AppError('Vous n etes pas autorise a modifier ce document.', 403);
  }

  const allowedFields = ['title', 'description', 'category', 'level'];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) resource[field] = updateData[field];
  });

  await resource.save();
  await invalidateFeedCache(); // Purge du cache
  
  // On renvoie la ressource avec le populate pour que le frontend (et le socket) ait l'avatar
  await resource.populate('uploadedBy', 'pseudo avatar');
  return resource;
};

// NOUVEAU : Logique de suppression sécurisée et centralisée
exports.deleteResource = async (id, userId, userRole) => {
  const resource = await Resource.findById(id);
  if (!resource) throw new AppError('Document introuvable.', 404);

  if (resource.uploadedBy.toString() !== userId.toString() && userRole !== 'admin' && userRole !== 'superadmin') {
    throw new AppError('Vous n etes pas autorise a supprimer ce document.', 403);
  }

  await resource.deleteOne();
  await invalidateFeedCache(); // Purge du cache
  return true;
};