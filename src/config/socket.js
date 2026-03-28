const socketIo = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { QueueEvents } = require('bullmq');
const jwt = require('jsonwebtoken');
const env = require('./env');
const logger = require('./logger');
const User = require('../models/User');
const redisClient = require('./redis');

let io;
const connectedUsers = new Map();

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: env.NODE_ENV === 'production' ? env.CLIENT_URL : '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Événements pour les ressources documentaires
  const uploadEvents = new QueueEvents('resource-upload', {
    connection: { url: process.env.REDIS_URI }
  });

  uploadEvents.on('completed', ({ jobId, returnvalue }) => {
    try {
      const result = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
      if (result && result.resourceData) {
        io.emit('newResource', result.resourceData);
        logger.info(`Ressource prete emise via Socket (Job: ${jobId})`);
      }
    } catch (error) {
      logger.error('Erreur lors de l emission Socket depuis QueueEvents:', error);
    }
  });

  // NOUVEAU : Événements pour le Feed (Fanout terminé = nouveau post disponible)
  const feedEvents = new QueueEvents('feed', {
    connection: { url: process.env.REDIS_URI }
  });

  feedEvents.on('completed', ({ jobId, returnvalue }) => {
    try {
      // returnvalue devrait contenir la liste des users qui ont recu le post
      // et l'ID du post. On pourrait émettre uniquement à ces utilisateurs,
      // mais pour l'instant, on avertit tout le monde qu'un nouveau post est là
      // pour qu'ils puissent afficher un bouton "Nouveaux posts disponibles"
      if (returnvalue && returnvalue.postId) {
        io.emit('new_post_available', { postId: returnvalue.postId, authorId: returnvalue.authorId });
      }
    } catch (error) {
      logger.error('Erreur lors de l emission Socket pour le Feed:', error);
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentification requise'));

      const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await User.findById(decoded.id).select('_id').lean();
      if (!user) return next(new Error('Utilisateur non trouve'));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Token invalide ou expire'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    connectedUsers.set(userId, socket.id);
    logger.info(`Utilisateur connecte au Socket: ${userId}`);

    socket.join(`user_${userId}`);

    // Messagerie
    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('user_typing', { userId, isTyping });
    });

    // Temps réel Social
    socket.on('post_action', ({ postId, action, data }) => {
      // action = 'like', 'comment_added', 'comment_deleted'
      // On re-diffuse cette action à TOUT LE MONDE sauf à l'expéditeur
      socket.broadcast.emit('post_updated', { postId, action, data });
    });

    socket.on('disconnect', (reason) => {
      connectedUsers.delete(userId);
      logger.info(`Utilisateur deconnecte du Socket: ${userId} (Raison: ${reason})`);
    });
  });

  return io;
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId.toString()}`).emit(event, data);
  }
};

const getIo = () => {
  if (!io) throw new Error('Socket.io n a pas ete initialise.');
  return io;
};

module.exports = { initSocket, getIo, emitToUser };