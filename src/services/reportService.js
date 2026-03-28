const Report = require('../models/Report');
const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const fs = require('fs');

const createReport = async (userId, postId, reason, files) => {
  if (!postId || !reason) {
    throw new AppError('Le post et la raison du signalement sont obligatoires.', 400);
  }

  let screenshotsUrls = [];
  
  if (files && files.length > 0) {
    if (files.length > 3) {
      throw new AppError('Maximum 3 captures d\'ecran autorisees.', 400);
    }
    
    for (const file of files) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'LokoNet_reports',
        });
        screenshotsUrls.push(result.secure_url);
        
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        throw new AppError('Erreur lors de l\'upload des captures d\'ecran.', 500);
      }
    }
  }

  const report = await Report.create({
    reporter: userId,
    reportedPost: postId,
    reason: reason,
    screenshots: screenshotsUrls
  });

  return report;
};

module.exports = { createReport };