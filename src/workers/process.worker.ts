import { Worker } from 'bullmq';
import { connection } from '../lib/constants';
import { sendTelegramMessage } from '../bot/telegram';
import { prisma } from '../db/prisma';
import { htmlToText } from 'html-to-text';

function formatMessage(jobData: any, keyword: string, isManualScan: boolean) {
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

  const scanType = isManualScan ? '🔍 Manual Scan' : '🆕 New Job';

  const cleanDescription = htmlToText(jobData.description || '', {
    wordwrap: 130,
    selectors: [{ selector: 'a', options: { ignoreHref: true } }],
  });

  const shortDescription =
    cleanDescription.length > 200
      ? cleanDescription.substring(0, 200) + '...'
      : cleanDescription;

  const message = `
${scanType}

*${jobData.title}*
🏢 ${jobData.company}
🔖 ${keyword} | 📍 ${jobData.source}
⏰ Posted: ${timeAgo}

${shortDescription}

[Apply Here](${jobData.link})
        `.trim();
  return message;
}

new Worker(
  'processQueue',
  async job => {
    try {
      const {
        job: jobId,
        keyword,
        isManualScan = false,
        triggeringUserId,
      } = job.data;

      const jobData = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!jobData) {
        console.error(`Job ${jobId} not found in database`);
        return;
      }
      const message = formatMessage(jobData, keyword, isManualScan);

      if (isManualScan && triggeringUserId) {
        const user = await prisma.user.findUnique({
          where: { telegramId: triggeringUserId },
        });

        if (user) {
          await sendTelegramMessage(user.telegramId, message);
        }
        return;
      }
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

      for (const user of interestedUsers) {
        try {
          await sendTelegramMessage(user.telegramId, message);
        } catch (error) {
          console.error(`❌ Failed to send to user ${user.telegramId}:`, error);
        }
      }
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
