import { Worker } from 'bullmq';
import { connection } from '../lib/constants';
import { sendTelegramMessage } from '../bot/telegram';
import { prisma } from '../db/prisma';

new Worker(
  'processQueue',
  async job => {
    try {
      const { job: jobId, keyword } = job.data;

      console.log(
        `Processing job notification for job ID: ${jobId}, keyword: ${keyword}`,
      );

      const jobData = await prisma.job.findUnique({ where: { id: jobId } });
      if (!jobData) {
        console.error(`Job ${jobId} not found in database`);
        return;
      }

      const interestedUsers = await prisma.user.findMany({
        where: {
          active: true,
          preferences: { some: { keyword: keyword } },
        },
        include: { preferences: true },
      });

      for (const user of interestedUsers) {
        const message = `
🆕 *New ${jobData.source} Job!*

*${jobData.title}*
🏢 Company: ${jobData.company}
🔖 Keyword: ${keyword}

${jobData.description.substring(0, 200)}${jobData.description.length > 200 ? '...' : ''}

[Apply Here](${jobData.link})
        `.trim();

        try {
          await sendTelegramMessage(user.telegramId, message);
          console.log(`✅ Sent ${keyword} job to user ${user.telegramId}`);
        } catch (error: any) {
          console.error(`❌ Failed to send to user ${user.telegramId}:`, error);

          if (
            error.response?.body?.description?.includes(
              'bot was blocked by the user',
            )
          ) {
            console.log(
              `User ${user.telegramId} blocked the bot. Marking inactive.`,
            );
            await prisma.user.updateMany({
              where: { telegramId: user.telegramId },
              data: { active: false },
            });
          }
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
