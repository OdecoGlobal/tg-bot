import { Worker } from 'bullmq';
import { connection } from '../lib/constants';
import {
  scanRemoteOKJobs,
  scanWeWorkRemotelyJobs,
  scanRemotiveJobs,
} from '../services/scan.service';
import { sendTelegramMessage } from '../bot/telegram';
import { prisma } from '../db/prisma';

async function notifyUsersWithPreferences(message: string) {
  const activeUsers = await prisma.user.findMany({
    where: {
      active: true,
      preferences: {
        some: {},
      },
    },
  });

  for (const user of activeUsers) {
    try {
      await sendTelegramMessage(user.telegramId, message);
    } catch (error) {
      console.error(`Failed to notify user ${user.telegramId}:`, error);
    }
  }
}

async function getLatestJobsSummary() {
  const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);
  const recentJobs = await prisma.job.findMany({
    where: {
      createdAt: {
        gte: cutoffTime,
      },
    },
    select: {
      id: true,
      title: true,
      source: true,
      keyword: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return recentJobs;
}

new Worker(
  'scannerQueue',
  async job => {
    try {
      console.log(`🔍 Auto scan started: ${job.name}`);

      await notifyUsersWithPreferences('🔍 Scanning for latest jobs...');

      const scanOptions = {
        maxJobsPerSite: 20,
        maxAgeInDays: 0.25,
        isManualScan: false,
      };

      switch (job.name) {
        case 'scanRemoteOk':
          await scanRemoteOKJobs(scanOptions);
          break;
        case 'scanWeWorkRemotely':
          await scanWeWorkRemotelyJobs(scanOptions);
          break;
        case 'scanIndeed':
          await scanRemotiveJobs(scanOptions);
          break;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const latestJobs = await getLatestJobsSummary();

      if (latestJobs.length === 0) {
        await notifyUsersWithPreferences(
          '✅ Scan complete. No new jobs found in the last few hours.',
        );
      } else {
        const justNow = latestJobs.filter(
          j => Date.now() - j.createdAt.getTime() < 5 * 60 * 1000,
        );
        const lastHour = latestJobs.filter(j => {
          const age = Date.now() - j.createdAt.getTime();
          return age >= 5 * 60 * 1000 && age < 60 * 60 * 1000;
        });

        let summary = `✅ Scan complete!\n\n`;

        if (justNow.length > 0) {
          summary += `🔥 ${justNow.length} job${justNow.length > 1 ? 's' : ''} posted just now!\n`;
        }
        if (lastHour.length > 0) {
          summary += `⏰ ${lastHour.length} job${lastHour.length > 1 ? 's' : ''} from the last hour\n`;
        }

        summary += `\nYou'll receive notifications for jobs matching your preferences.`;

        await notifyUsersWithPreferences(summary);
      }

      console.log(
        `✅ Auto scan completed: ${job.name} - ${latestJobs.length} recent jobs`,
      );
    } catch (error) {
      console.error(`Error in auto scan ${job.name}:`, error);
      await notifyUsersWithPreferences(
        '❌ Scan failed. Will retry automatically.',
      );
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  },
);

console.log('Scanner worker started');
