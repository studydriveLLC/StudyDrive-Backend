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

  // Ecoute native des evenements de la file d'attente (Worker -> Main Process)
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

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('user_typing', { userId, isTyping });
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