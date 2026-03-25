//src/workers/feedQueue.js
const { Queue, Worker } = require('bullmq');
const Feed = require('../models/Feed');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const logger = require('../config/logger');

const connection = { url: process.env.REDIS_URI };

const feedQueue = new Queue('feed-fanout', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50
  }
});

const feedWorker = new Worker('feed-fanout', async (job) => {
  const { postId, authorId } = job.data;
  
  try {
    const author = await User.findById(authorId).select('followers pseudo').lean();
    
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
    
    const notificationPromises = followers.map((followerId) => 
      notificationService.sendNotification({
        recipientId: followerId,
        senderId: authorId,
        type: 'system',
        referenceId: postId,
        content: `${author.pseudo} a publie une nouvelle publication.`,
        dataPayload: { screen: 'PostDetail', postId: postId.toString() }
      }).catch(err => logger.error(`Erreur notification follower ${followerId}:`, err))
    );

    await Promise.allSettled(notificationPromises);
    
    logger.info(`Job BullMQ termine: Post ${postId} pousse dans ${followers.length} feeds et notifications envoyees.`);
    return { status: 'success', processed: followers.length };
  } catch (error) {
    logger.error(`Erreur BullMQ pour le post ${postId}:`, error);
    throw error;
  }
}, { connection });

feedWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} a echoue avec l'erreur ${err.message}`);
});

module.exports = { feedQueue };