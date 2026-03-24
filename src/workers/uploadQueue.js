const { Queue, Worker } = require('bullmq');
const cloudinary = require('../config/cloudinary');
const Resource = require('../models/Resource');
const logger = require('../config/logger');
const fs = require('fs');

const connection = { url: process.env.REDIS_URI };

const uploadQueue = new Queue('resource-upload', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

const uploadWorker = new Worker('resource-upload', async (job) => {
  const { resourceId, tempFilePath, originalName } = job.data;

  logger.info(`Worker upload: traitement du job ${job.id} pour la ressource ${resourceId}`);

  let cloudinaryResult;

  const isRawFormat = originalName.match(/\.(doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt)$/i);
  const resourceType = isRawFormat ? 'raw' : 'auto';

  try {
    cloudinaryResult = await cloudinary.uploader.upload(tempFilePath, {
      folder: 'LokoNet_resources',
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true
    });
  } catch (cloudinaryError) {
    logger.error(`Worker upload: echec Cloudinary pour la ressource ${resourceId}:`, cloudinaryError);

    await Resource.findByIdAndUpdate(resourceId, {
      status: 'failed',
      tempFilePath: null
    });

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    throw cloudinaryError;
  }

  const updatedResource = await Resource.findByIdAndUpdate(
    resourceId, 
    {
      fileUrl: cloudinaryResult.secure_url,
      status: 'ready',
      tempFilePath: null
    },
    { new: true }
  ).populate('uploadedBy', 'pseudo avatar badgeType firstName lastName');

  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  logger.info(`Worker upload: ressource ${resourceId} disponible - ${cloudinaryResult.secure_url}`);

  return {
    status: 'success',
    resourceId,
    fileUrl: cloudinaryResult.secure_url,
    resourceData: updatedResource
  };
}, { connection });

uploadWorker.on('failed', (job, err) => {
  logger.error(`Worker upload: job ${job.id} a echoue definitivement - ${err.message}`);
});

uploadWorker.on('completed', (job) => {
  logger.info(`Worker upload: job ${job.id} termine avec succes`);
});

module.exports = { uploadQueue };