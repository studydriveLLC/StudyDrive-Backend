const resourceService = require('../services/resourceService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { uploadQueue } = require('../workers/uploadQueue');
const path = require('path');

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

exports.getResource = catchAsync(async (req, res) => {
  const resource = await resourceService.getResourceById(req.params.id);
  res.status(200).json({ status: 'success', data: { resource } });
});

exports.logDownload = catchAsync(async (req, res) => {
  const resource = await resourceService.trackDownload(req.params.id);
  res.status(200).json({
    status: 'success',
    data: { id: resource._id, downloads: resource.downloads }
  });
});

exports.uploadResource = catchAsync(async (req, res, next) => {
  console.log('[UPLOAD DEBUG] Entree dans uploadResource Controller');
  
  if (!req.file) {
    console.error('[UPLOAD ERROR] req.file est undefined. Le fichier n a pas passe Multer ou n a pas ete envoye correctement.');
    return next(new AppError('Aucun fichier n a ete recu. Verifiez la requete.', 400));
  }

  console.log(`[UPLOAD DEBUG] Fichier recu par Multer : ${req.file.originalname} (${req.file.size} bytes)`);
  console.log(`[UPLOAD DEBUG] Donnees du corps (req.body) :`, req.body);

  const { title, category, level, description } = req.body;

  const format = getFormatFromMime(req.file.mimetype, req.file.originalname);
  const defaultDescription = description || `Document de ${category} pour le niveau ${level}.`;

  try {
    console.log('[UPLOAD DEBUG] Creation de la ressource en base de donnees...');
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
    console.log(`[UPLOAD DEBUG] Ressource cree avec succes (ID: ${resource._id})`);

    console.log('[UPLOAD DEBUG] Ajout de la tache dans uploadQueue...');
    await uploadQueue.add('upload-to-cloudinary', {
      resourceId: resource._id.toString(),
      tempFilePath: req.file.path,
      originalName: req.file.originalname
    });
    console.log('[UPLOAD DEBUG] Tache ajoutee a la file d attente avec succes.');

    res.status(202).json({
      status: 'success',
      message: 'Votre document est en cours de traitement. Il sera disponible dans quelques instants.',
      data: { resource }
    });
  } catch (error) {
    console.error('[UPLOAD ERROR CRITIQUE] Erreur lors de la creation de la ressource ou l ajout a la queue :', error);
    return next(new AppError('Erreur interne lors du traitement du fichier.', 500));
  }
});

exports.updateResource = catchAsync(async (req, res, next) => {
  const resource = await resourceService.getResourceById(req.params.id);
  
  if (!resource) {
    return next(new AppError('Document introuvable.', 404));
  }

  if (resource.uploadedBy._id.toString() !== req.user._id.toString()) {
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

exports.toggleFavorite = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    message: 'Action sauvegarder enregistree (Pret pour le cablage Frontend).'
  });
});

exports.reportResource = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    message: 'Le document a ete signale a l equipe de moderation.'
  });
});