const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) => {
  const message = `Format invalide pour le champ ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const sourceString = err.errmsg || err.message;
  const match = sourceString.match(/(["'])(\\?.)*?\1/);
  const value = match ? match[0] : 'Valeur';
  
  const message = `Valeur dupliquée: ${value}. Veuillez utiliser une autre valeur.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Données invalides. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Token invalide. Veuillez vous reconnecter.', 401);
const handleJWTExpiredError = () => new AppError('Votre token a expiré. Veuillez vous reconnecter.', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // 🔥 MOUCHARD BACKEND 🔥
    console.error('================ ALERTE CRASH FATAL ================');
    console.error('MESSAGE:', err.message);
    console.error('NOM:', err.name);
    console.error('STACK TRACE:', err.stack);
    console.error('OBJET COMPLET:', err);
    console.error('====================================================');
    
    logger.error('ERREUR NON OPÉRATIONNELLE 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Une erreur interne est survenue.'
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.code = err.code; // <- LIGNE POUR REPARER L'ERREUR 11000 MONGO
    error.errmsg = err.errmsg;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};