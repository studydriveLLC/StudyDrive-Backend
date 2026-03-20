const Document = require('../models/Document');
const Resource = require('../models/Resource');
const AppError = require('../utils/AppError');

// --- Section MyWord ---

const createDocument = async (authorId) => {
  return await Document.create({ author: authorId });
};

const autoSaveDocument = async (documentId, authorId, updateData) => {
  const document = await Document.findOneAndUpdate(
    { _id: documentId, author: authorId },
    { 
      $set: { 
        ...updateData, 
        lastSavedAt: Date.now() 
      } 
    },
    { new: true, runValidators: true }
  ).lean();

  if (!document) {
    throw new AppError('Document introuvable ou vous n\'en etes pas l\'auteur.', 404);
  }

  return document;
};

const getUserDocuments = async (authorId) => {
  return await Document.find({ author: authorId })
    .sort({ updatedAt: -1 })
    .select('title status lastSavedAt updatedAt')
    .lean();
};

// --- Section Ressources ---

const createResource = async (authorId, resourceData, fileData) => {
  if (!fileData) {
    throw new AppError('Le fichier est obligatoire.', 400);
  }

  const resource = await Resource.create({
    title: resourceData.title,
    description: resourceData.description,
    major: resourceData.major,
    fileUrl: fileData.path, 
    fileType: fileData.mimetype,
    author: authorId,
  });

  return resource;
};

const updateResource = async (userId, resourceId, updateData, userRole) => {
  const resource = await Resource.findById(resourceId);
  
  if (!resource) {
    throw new AppError('Ressource introuvable.', 404);
  }

  // Seul l'auteur ou l'administration peut modifier
  if (resource.author.toString() !== userId.toString() && userRole !== 'superadmin' && userRole !== 'admin') {
    throw new AppError('Vous n\'avez pas les droits pour modifier cette ressource.', 403);
  }

  const allowedFields = ['title', 'description', 'major'];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      resource[field] = updateData[field];
    }
  });

  await resource.save();
  return resource;
};

const deleteResource = async (userId, resourceId, userRole) => {
  const resource = await Resource.findById(resourceId);
  
  if (!resource) {
    throw new AppError('Ressource introuvable.', 404);
  }

  // Seul l'auteur ou l'administration peut supprimer
  if (resource.author.toString() !== userId.toString() && userRole !== 'superadmin' && userRole !== 'admin') {
    throw new AppError('Vous n\'avez pas les droits pour supprimer cette ressource.', 403);
  }

  await Resource.findByIdAndDelete(resourceId);
  return true;
};

const getResources = async (filters, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = {};

  if (filters.major) {
    query.major = filters.major;
  }
  
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } }
    ];
  }

  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'firstName lastName pseudo')
    .lean();

  return resources;
};

const incrementDownload = async (resourceId) => {
  await Resource.findByIdAndUpdate(resourceId, { $inc: { 'stats.downloads': 1 } });
};

module.exports = {
  createDocument,
  autoSaveDocument,
  getUserDocuments,
  createResource,
  updateResource,
  deleteResource,
  getResources,
  incrementDownload,
};