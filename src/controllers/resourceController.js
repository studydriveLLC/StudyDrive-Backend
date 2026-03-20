const resourceService = require('../services/resourceService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getResources = catchAsync(async (req, res) => {
  const data = await resourceService.getAllResources(req.query);
  res.status(200).json({
    status: 'success',
    data
  });
});

exports.getResource = catchAsync(async (req, res) => {
  const resource = await resourceService.getResourceById(req.params.id);
  res.status(200).json({
    status: 'success',
    data: { resource }
  });
});

exports.logDownload = catchAsync(async (req, res) => {
  const resource = await resourceService.trackDownload(req.params.id);
  res.status(200).json({
    status: 'success',
    data: { 
      id: resource._id,
      downloads: resource.downloads 
    }
  });
});

exports.uploadResource = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('Aucun fichier n\'a été reçu', 400);
  }

  let format = 'pdf';
  if (req.file.mimetype === 'image/jpeg') format = 'jpg';
  if (req.file.mimetype === 'image/png') format = 'png';
  if (req.file.mimetype.includes('wordprocessingml.document')) format = 'docx';
  if (req.file.mimetype === 'application/msword') format = 'doc';
  if (req.file.mimetype.includes('spreadsheetml.sheet')) format = 'xlsx';

  const defaultDescription = `Document de ${req.body.category} pour le niveau ${req.body.level}.`;

  const resourceData = {
    title: req.body.title,
    description: req.body.description || defaultDescription,
    category: req.body.category,
    level: req.body.level,
    fileUrl: req.file.path, 
    fileSize: req.file.size || 0, 
    format: format,
    uploadedBy: req.user._id 
  };

  const newResource = await resourceService.createResource(resourceData);

  res.status(201).json({
    status: 'success',
    data: { resource: newResource }
  });
});