const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('sanitize-html'); 
const compression = require('compression');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const logger = require('./config/logger');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const socialRoutes = require('./routes/socialRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(helmet());

app.use(cors({
  origin: env.NODE_ENV === 'production' ? env.CLIENT_URL : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: 'Trop de requetes depuis cette IP, veuillez reessayer dans une heure.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression());

// 🔥 LE PATCH DE COMPATIBILITÉ EXPRESS 5 EST ICI 🔥
// Il doit absolument être placé AVANT mongoSanitize()
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// Maintenant mongoSanitize peut s'exécuter sans crasher le serveur
app.use(mongoSanitize());

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]); 
      }
    });
  }
  next();
});

if (env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });
}

app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Bienvenue sur l API StudyDrive' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API operationnelle' });
});

app.use('/api/auth', authRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

app.use((req, res, next) => {
  next(new AppError(`Impossible de trouver ${req.originalUrl} sur ce serveur!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;