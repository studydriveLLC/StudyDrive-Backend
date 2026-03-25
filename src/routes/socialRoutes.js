src/routes/socialRoutes.js
const express = require('express');
const socialController = require('../controllers/socialController');
const socialValidation = require('../validations/socialValidation');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/follow/:targetId', socialValidation.validate(socialValidation.targetUserSchema), socialController.follow);
router.post('/unfollow/:targetId', socialValidation.validate(socialValidation.targetUserSchema), socialController.unfollow);
router.get('/status/:targetId', socialValidation.validate(socialValidation.targetUserSchema), socialController.getFollowStatus);
router.get('/my-stats', socialController.getMyFollowStats);

router.post('/posts', socialValidation.validate(socialValidation.createPostSchema), socialController.createPost);
router.get('/feed', socialController.getFeed);
router.get('/posts/:postId', socialController.getPost);
router.put('/posts/:postId', socialController.updatePost);
router.delete('/posts/:postId', socialController.deletePost);

router.post('/posts/:postId/like', socialController.toggleLike);
router.post('/posts/:postId/share', socialController.incrementShares);

router.post('/posts/:postId/comments', socialController.addComment);
router.put('/posts/:postId/comments/:commentId', socialController.updateComment);
router.delete('/posts/:postId/comments/:commentId', socialController.deleteComment);

module.exports = router;