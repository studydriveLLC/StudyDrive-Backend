const resourceService = require('../services/resourceService');
const notificationService = require('../services/notificationService');
const Resource = require('../models/Resource');
const User = require('../models/User');
const Report = require('../models/Report');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { uploadQueue } = require('../workers/uploadQueue');
const path = require('path');
const { getIo } = require('../config/socket');

const getFormatFromMime = (mimetype, filename) => {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'application/msword') return 'doc';
  if (mimetype.includes('wordprocessingml.document')) return 'docx';
  if (mimetype.includes('spreadsheetml.sheet')) return 'xlsx';
  if (mimetype === 'image/jpeg') return 'jpg';
  if (mimetype === 'image/png') return 'png';

  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return ext || 'pdf';
};

exports.getResources = catchAsync(async (req, res) => {
  const data = await resourceService.getAllResources(req.query);
  res.status(200).json({ status: 'success', data });
});

exports.getResource = catchAsync(async (req, res, next) => {
  const resource = await resourceService.getResourceById(req.params.id);
  if (!resource) {
    return next(new AppError('Document introuvable.', 404));
  }
  res.status(200).json({ status: 'success', data: { resource } });
});

exports.logView = catchAsync(async (req, res, next) => {
  const resource = await resourceService.trackView(req.params.id);

  try {
    getIo().emit('resourceStatsUpdated', { 
      id: resource._id.toString(), 
      views: resource.views, 
      downloads: resource.downloads 
    });
  } catch (error) {
    console.error('Erreur Socket lors de l emission de la vue:', error);
  }

  res.status(200).json({
    status: 'success',
    data: { id: resource._id, views: resource.views }
  });
});

exports.logDownload = catchAsync(async (req, res, next) => {
  const resource = await resourceService.trackDownload(req.params.id);
  
  try {
    getIo().emit('resourceStatsUpdated', { 
      id: resource._id.toString(), 
      views: resource.views, 
      downloads: resource.downloads 
    });
  } catch (error) {
    console.error('Erreur Socket lors de l emission du telechargement:', error);
  }

  res.status(200).json({
    status: 'success',
    data: { id: resource._id, downloads: resource.downloads }
  });
});

exports.uploadResource = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Aucun fichier n a ete recu. Verifiez la requete.', 400));
  }

  const { title, category, level, description } = req.body;
  const format = getFormatFromMime(req.file.mimetype, req.file.originalname);
  const defaultDescription = description || `Document de ${category} pour le niveau ${level}.`;

  try {
    const resource = await resourceService.createResource({
      title,
      description: defaultDescription,
      category,
      level,
      format,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      tempFilePath: req.file.path,
      status: 'processing'
    });

    await uploadQueue.add('upload-to-cloudinary', {
      resourceId: resource._id.toString(),
      tempFilePath: req.file.path,
      originalName: req.file.originalname
    });

    res.status(202).json({
      status: 'success',
      message: 'Votre document est en cours de traitement. Il sera disponible dans quelques instants.',
      data: { resource }
    });
  } catch (error) {
    return next(new AppError('Erreur interne lors du traitement du fichier.', 500));
  }
});

exports.updateResource = catchAsync(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    return next(new AppError('Document introuvable.', 404));
  }

  if (resource.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return next(new AppError('Vous n etes pas autorise a modifier ce document.', 403));
  }

  const { title, description, category, level } = req.body;
  
  if (title) resource.title = title;
  if (description) resource.description = description;
  if (category) resource.category = category;
  if (level) resource.level = level;

  await resource.save();

  res.status(200).json({
    status: 'success',
    data: { resource }
  });
});

exports.deleteResource = catchAsync(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);
  
  if (!resource) {
    return next(new AppError('Document introuvable.', 404));
  }

  if (resource.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return next(new AppError('Vous n etes pas autorise a supprimer ce document.', 403));
  }

  await resource.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.toggleFavorite = catchAsync(async (req, res, next) => {
  const resourceId = req.params.id;
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('Utilisateur introuvable.', 404));
  }

  const isFavorited = user.favorites.includes(resourceId);
  
  if (isFavorited) {
    user.favorites.pull(resourceId);
  } else {
    user.favorites.push(resourceId);
  }
  
  await user.save();

  res.status(200).json({
    status: 'success',
    message: isFavorited ? 'Ressource retiree de vos favoris' : 'Ressource ajoutee a vos favoris',
    data: { isFavorited: !isFavorited }
  });
});

exports.reportResource = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new AppError('Le motif du signalement est obligatoire.', 400));
  }

  const report = await Report.create({
    resource: req.params.id,
    reportedBy: req.user._id,
    reason
  });

  res.status(201).json({
    status: 'success',
    message: 'Le document a ete signale a l equipe de moderation.',
    data: { report }
  });
});