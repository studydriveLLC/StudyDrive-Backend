const express = require('express');
const workspaceController = require('../controllers/workspaceController');
const workspaceValidation = require('../validations/workspaceValidation');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

// --- Routes MyWord ---
router.post('/documents', workspaceController.initDocument);
router.get('/documents', workspaceController.getMyDocuments);
router.patch(
  '/documents/:documentId',
  workspaceValidation.validate(workspaceValidation.autoSaveSchema),
  workspaceController.saveDocument
);

// --- Routes Ressources ---
router.post(
  '/resources',
  upload.single('file'), 
  workspaceValidation.validate(workspaceValidation.createResourceSchema),
  workspaceController.uploadResource
);

router.get('/resources', workspaceController.getResources);
router.put('/resources/:resourceId', workspaceController.editResource);
router.delete('/resources/:resourceId', workspaceController.removeResource);
router.post('/resources/:resourceId/download', workspaceController.trackDownload);

module.exports = router;