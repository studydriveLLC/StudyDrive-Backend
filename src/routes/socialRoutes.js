const express = require('express');
const socialController = require('../controllers/socialController');
const socialValidation = require('../validations/socialValidation');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Toutes les routes sociales exigent d'etre connecte
router.use(authMiddleware.protect);

// Actions d'abonnement
router.post('/follow/:targetId', socialValidation.validate(socialValidation.targetUserSchema), socialController.follow);
router.post('/unfollow/:targetId', socialValidation.validate(socialValidation.targetUserSchema), socialController.unfollow);

// Actions de publication
router.post('/posts', socialValidation.validate(socialValidation.createPostSchema), socialController.createPost);
router.get('/feed', socialController.getFeed);
router.put('/posts/:postId', socialController.updatePost);
router.delete('/posts/:postId', socialController.deletePost);

// Interactions (Likes et Partages)
router.post('/posts/:postId/like', socialController.toggleLike);
router.post('/posts/:postId/share', socialController.incrementShares);

// Commentaires
router.post('/posts/:postId/comments', socialController.addComment);
router.put('/posts/:postId/comments/:commentId', socialController.updateComment);
router.delete('/posts/:postId/comments/:commentId', socialController.deleteComment);

module.exports = router;