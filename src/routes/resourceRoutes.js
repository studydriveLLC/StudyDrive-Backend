const express = require('express');
const resourceController = require('../controllers/resourceController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const resourceValidation = require('../validations/resourceValidation');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', resourceController.getResources);
router.get('/:id', resourceController.getResource);
router.post('/:id/download', resourceController.logDownload);

router.post(
  '/',
  upload.single('file'),
  resourceValidation.validate(resourceValidation.createResourceSchema),
  resourceController.uploadResource
);

router.put('/:id', resourceController.updateResource);
router.post('/:id/favorite', resourceController.toggleFavorite);
router.post('/:id/report', resourceController.reportResource);

module.exports = router;