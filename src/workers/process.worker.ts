import { Worker } from 'bullmq';
import { connection } from '../lib/constants';
import { sendTelegramMessage } from '../bot/telegram';
import { prisma } from '../db/prisma';

new Worker(
  'processQueue',
  async job => {
    try {
      const { job: jobId, keyword, isManualScan = false } = job.data;

      console.log(
        `Processing job notification for job ID: ${jobId} (manual: ${isManualScan})`,
      );

      const jobData = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!jobData) {
        console.error(`Job ${jobId} not found in database`);
        return;
      }

      // Only get users interested in this keyword
      const interestedUsers = await prisma.user.findMany({
        where: {
          preferences: {
            some: {
              keyword: keyword,
            },
          },
        },
        include: {
          preferences: true,
        },
      });

      console.log(
        `Sending "${keyword}" job to ${interestedUsers.length} interested users`,
      );

      for (const user of interestedUsers) {
        const jobAge = Date.now() - jobData.createdAt.getTime();
        const hoursAgo = Math.floor(jobAge / (1000 * 60 * 60));
        const daysAgo = Math.floor(hoursAgo / 24);

        let timeAgo = '';
        if (daysAgo > 0) {
          timeAgo = `${daysAgo}d ago`;
        } else if (hoursAgo > 0) {
          timeAgo = `${hoursAgo}h ago`;
        } else {
          timeAgo = 'just now';
        }

        // Add indicator for manual scans
        const scanType = isManualScan ? '🔍 Manual Scan' : '🆕 New Job';

        const message = `
${scanType}

*${jobData.title}*
🏢 ${jobData.company}
🔖 ${keyword} | 📍 ${jobData.source}
⏰ Posted: ${timeAgo}

${jobData.description.substring(0, 200)}${jobData.description.length > 200 ? '...' : ''}

[Apply Here](${jobData.link})
        `.trim();

        try {
          await sendTelegramMessage(user.telegramId, message);
          console.log(`✅ Sent ${keyword} job to user ${user.telegramId}`);
        } catch (error) {
          console.error(`❌ Failed to send to user ${user.telegramId}:`, error);
        }
      }

      console.log(`Finished processing job ${jobId}`);
    } catch (error) {
      console.error('Error processing job:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

console.log('Process worker started');
