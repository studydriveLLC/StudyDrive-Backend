const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', upload.array('screenshots', 3), reportController.createReport);

module.exports = router;