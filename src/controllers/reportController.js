const reportService = require('../services/reportService');

const createReport = async (req, res, next) => {
  try {
    const { postId, reason } = req.body;
    const report = await reportService.createReport(req.user._id, postId, reason, req.files);
    
    res.status(201).json({ 
      status: 'success', 
      message: 'Signalement envoye avec succes.',
      data: { report } 
    });
  } catch (error) { 
    next(error); 
  }
};

module.exports = { createReport };