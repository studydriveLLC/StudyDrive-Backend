const Resource = require('../models/Resource');
const AppError = require('../utils/AppError');
const redisClient = require('../config/redis');

// Fonction utilitaire pour purger le cache de la liste des ressources
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
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.error('Erreur Redis GET ignoree, fallback sur MongoDB:', err);
  }

  const filter = { status: 'ready' };

  if (search) {
    filter.$text = { $search: search };
  }
  if (category) filter.category = category;
  if (level) filter.level = level;

  const skip = (page - 1) * limit;

  let queryBuilder = Resource.find(filter)
    .populate('uploadedBy', 'pseudo avatar')
    .skip(skip)
    .limit(limit);

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
  } catch (err) {
    console.error('Erreur Redis SET ignoree:', err);
  }

  return result;
};

exports.getResourceById = async (id) => {
  const cacheKey = `resource:detail:${id}`;
  
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (err) {}

  const resource = await Resource.findById(id).populate('uploadedBy', 'pseudo avatar');

  if (!resource) {
    throw new AppError('Ressource non trouvee.', 404);
  }

  if (resource.status !== 'ready') {
    throw new AppError('Cette ressource est en cours de traitement, elle sera disponible dans quelques instants.', 202);
  }

  try {
    await redisClient.set(cacheKey, JSON.stringify(resource), 'EX', 120);
  } catch (err) {}

  return resource;
};

exports.trackView = async (id) => {
  const resource = await Resource.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true, runValidators: true }
  );

  if (!resource) {
    throw new AppError('Ressource non trouvee.', 404);
  }
  
  try {
     await redisClient.del(`resource:detail:${id}`);
     await invalidateFeedCache();
  } catch (err) {}

  return resource;
};

exports.trackDownload = async (id) => {
  const resource = await Resource.findByIdAndUpdate(
    id,
    { $inc: { downloads: 1 } },
    { new: true, runValidators: true }
  );

  if (!resource) {
    throw new AppError('Ressource non trouvee.', 404);
  }
  
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