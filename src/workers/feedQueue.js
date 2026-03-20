const { Queue, Worker } = require('bullmq');
const Feed = require('../models/Feed');
const User = require('../models/User');
const logger = require('../config/logger');

// Paramètres de connexion réutilisant l'URI Redis
const connection = { url: process.env.REDIS_URI };

// 1. Initialisation de la file d'attente avec OPTIMISATION REDIS PAR DÉFAUT
const feedQueue = new Queue('feed-fanout', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: true, // Purge instantanée de Redis en cas de succès
    removeOnFail: 50        // On ne garde que les 50 dernières erreurs pour ne pas saturer la RAM
  }
});

// 2. Logique d'exécution (Le Worker)
const feedWorker = new Worker('feed-fanout', async (job) => {
  const { postId, authorId } = job.data;
  
  try {
    const author = await User.findById(authorId).select('followers').lean();
    
    if (!author || !author.followers || author.followers.length === 0) {
      return { status: 'skipped', reason: 'no_followers' };
    }

    const followers = author.followers;

    const bulkOps = followers.map((followerId) => ({
      updateOne: {
        filter: { user: followerId },
        update: {
          $push: {
            posts: {
              $each: [{ post: postId, addedAt: new Date() }],
              $position: 0,
              $slice: 500
            }
          }
        },
        upsert: true
      }
    }));

    await Feed.bulkWrite(bulkOps, { ordered: false });
    
    logger.info(`Job BullMQ terminé: Post ${postId} poussé dans ${followers.length} feeds.`);
    return { status: 'success', processed: followers.length };
  } catch (error) {
    logger.error(`Erreur BullMQ pour le post ${postId}:`, error);
    throw error; // Lancer l'erreur permet à BullMQ de retenter le job plus tard
  }
}, { connection });

// Gestion des erreurs internes du Worker
feedWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} a échoué avec l'erreur ${err.message}`);
});

module.exports = { feedQueue };