import { Worker } from 'bullmq';
import { connection } from '../lib/constants';
import {
  scanRemoteOKJobs,
  scanWeWorkRemotelyJobs,
  scanRemotiveJobs,
} from '../services/scan.service';
import { sendTelegramMessage } from '../bot/telegram';
import { prisma } from '../db/prisma';

const lastNoJobsNotification = new Map<string, number>();
const NO_JOBS_NOTIFICATION_INTERVAL = 12 * 60 * 60 * 1000;

async function notifyUsersWithPreferences(
  message: string,
  onlyIfIntervalPassed = false,
) {
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
      if (onlyIfIntervalPassed) {
        const lastNotified = lastNoJobsNotification.get(user.telegramId) || 0;
        const timeSinceLastNotification = Date.now() - lastNotified;

        if (timeSinceLastNotification < NO_JOBS_NOTIFICATION_INTERVAL) {
          continue;
        }

        lastNoJobsNotification.set(user.telegramId, Date.now());
      }

      await sendTelegramMessage(user.telegramId, message);
    } catch (error) {}
  }
}

new Worker(
  'scannerQueue',
  async job => {
    try {
      console.log('🔍 Auto scan started');

      const scanOptions = {
        maxJobsPerSite: 20,
        maxAgeInDays: 0.04,
        isManualScan: false,
      };

      const jobCountBefore = await prisma.job.count();

      await Promise.all([
        scanRemoteOKJobs(scanOptions),
        scanWeWorkRemotelyJobs(scanOptions),
        scanRemotiveJobs(scanOptions),
      ]);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const jobCountAfter = await prisma.job.count();
      const newJobsCount = jobCountAfter - jobCountBefore;

      if (newJobsCount === 0) {
        await notifyUsersWithPreferences(
          '✅ Scan complete. No new jobs found.',
          true,
        );
      } else {
        await notifyUsersWithPreferences(
          `✅ Found ${newJobsCount} new job${newJobsCount > 1 ? 's' : ''}! Check your notifications.`,
        );
      }
    } catch (error) {
      console.error('❌ Auto scan error:', error);
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

console.log('✅ Scanner worker started');
