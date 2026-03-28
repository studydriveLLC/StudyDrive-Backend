//src/services/resourceService.js
const Resource = require('../models/Resource');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const redisClient = require('../config/redis');
const notificationService = require('./notificationService');

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
  // CORRECTION : Ajout de uploadedBy dans l'extraction
  const { search, category, level, sort, page = 1, limit = 10, uploadedBy } = query;
  
  // CORRECTION : Ajout de uploadedBy dans la clé de cache pour éviter les fuites de données entre profils
  const cacheKey = `resources:feed:${search || 'all'}:${category || 'all'}:${level || 'all'}:${sort || 'new'}:${uploadedBy || 'all'}:${page}:${limit}`;

  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {}

  const filter = { status: 'ready' };
  
  // CORRECTION : Application stricte du filtre utilisateur si fourni
  if (uploadedBy) {
    filter.uploadedBy = uploadedBy;
  }
  
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (category) filter.category = category;
  if (level) filter.level = level;

  const skip = (page - 1) * limit;
  let queryBuilder = Resource.find(filter).populate('uploadedBy', 'pseudo avatar isVerified badge role').skip(skip).limit(limit);

  if (sort === 'popular') {
    queryBuilder = queryBuilder.sort({ downloads: -1, shares: -1, views: -1 });
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

exports.getMyResources = async (userId) => {
  const resources = await Resource.find({ uploadedBy: userId })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'pseudo avatar isVerified badge role');
  return resources;
};

exports.getResourceById = async (id) => {
  const cacheKey = `resource:detail:${id}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (err) {}

  const resource = await Resource.findById(id).populate('uploadedBy', 'pseudo avatar isVerified badge role');
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

exports.trackShare = async (id) => {
  const resource = await Resource.findByIdAndUpdate(id, { $inc: { shares: 1 } }, { new: true, runValidators: true });
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

  try {
    const author = await User.findById(resourceData.uploadedBy).select('followers pseudo');
    if (author && author.followers && author.followers.length > 0) {
      author.followers.forEach(followerId => {
        notificationService.sendNotification({
          recipientId: followerId,
          senderId: author._id,
          type: 'system',
          referenceId: resource._id,
          content: `${author.pseudo} a publie une nouvelle ressource.`,
          dataPayload: { screen: 'ResourceDetail', resourceId: resource._id.toString(), type: 'RESOURCE_LINK' }
        }).catch(err => console.error("Erreur notification push follower:", err));
      });
    }
  } catch (err) {
    console.error("Erreur lors de l'envoi des notifications aux followers:", err);
  }

  return resource;
};

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
  await invalidateFeedCache(); 
  
  await resource.populate('uploadedBy', 'pseudo avatar isVerified badge role');
  return resource;
};

exports.deleteResource = async (id, userId, userRole) => {
  const resource = await Resource.findById(id);
  if (!resource) throw new AppError('Document introuvable.', 404);

  if (resource.uploadedBy.toString() !== userId.toString() && userRole !== 'admin' && userRole !== 'superadmin') {
    throw new AppError('Vous n etes pas autorise a supprimer ce document.', 403);
  }

  await resource.deleteOne();
  await invalidateFeedCache(); 
  return true;
};