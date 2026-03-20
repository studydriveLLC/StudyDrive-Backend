const multer = require('multer');
const AppError = require('../utils/AppError');

// Utilisation de la mémoire RAM pour stocker temporairement le fichier
// Cela empêche le serveur de se bloquer si le service externe ne répond pas
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Format de fichier non supporté. Seuls les PDF, DOCX, XLSX et Images sont autorisés.', 400), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, 
  },
});

module.exports = upload;