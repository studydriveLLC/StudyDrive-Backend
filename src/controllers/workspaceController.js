const workspaceService = require('../services/workspaceService');

// --- Section MyWord ---

const initDocument = async (req, res, next) => {
  try {
    const document = await workspaceService.createDocument(req.user._id);
    res.status(201).json({ status: 'success', data: { document } });
  } catch (error) { next(error); }
};

const saveDocument = async (req, res, next) => {
  try {
    const document = await workspaceService.autoSaveDocument(req.params.documentId, req.user._id, req.body);
    res.status(200).json({ status: 'success', data: { document } });
  } catch (error) { next(error); }
};

const getMyDocuments = async (req, res, next) => {
  try {
    const documents = await workspaceService.getUserDocuments(req.user._id);
    res.status(200).json({ status: 'success', results: documents.length, data: { documents } });
  } catch (error) { next(error); }
};

// --- Section Ressources ---

const uploadResource = async (req, res, next) => {
  try {
    const resource = await workspaceService.createResource(req.user._id, req.body, req.file);
    res.status(201).json({ status: 'success', data: { resource } });
  } catch (error) { next(error); }
};

const editResource = async (req, res, next) => {
  try {
    const resource = await workspaceService.updateResource(req.user._id, req.params.resourceId, req.body, req.user.role);
    res.status(200).json({ status: 'success', data: { resource } });
  } catch (error) { next(error); }
};

const removeResource = async (req, res, next) => {
  try {
    await workspaceService.deleteResource(req.user._id, req.params.resourceId, req.user.role);
    res.status(200).json({ status: 'success', message: 'Ressource supprimee avec succes.' });
  } catch (error) { next(error); }
};

const getResources = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    
    const filters = {
      major: req.query.major,
      search: req.query.search
    };

    const resources = await workspaceService.getResources(filters, page, limit);

    res.status(200).json({ status: 'success', results: resources.length, data: { resources } });
  } catch (error) { next(error); }
};

const trackDownload = async (req, res, next) => {
  try {
    await workspaceService.incrementDownload(req.params.resourceId);
    res.status(200).json({ status: 'success' });
  } catch (error) { next(error); }
};

module.exports = {
  initDocument,
  saveDocument,
  getMyDocuments,
  uploadResource,
  editResource,
  removeResource,
  getResources,
  trackDownload,
};