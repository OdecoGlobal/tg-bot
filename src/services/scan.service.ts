import { prisma } from '../db/prisma';
import { processQueue } from '../queues/process.queue';
import { fetchRemoteOK } from '../scrapper/remoteok';
import { fetchWeWorkRemotely } from '../scrapper/weworkremotely';
import { fetchRemotive } from '../scrapper/remotive';

type ScanOptions = {
  maxJobsPerSite?: number;
  maxAgeInDays?: number;
  isManualScan?: boolean;
  triggeringUserId?: string;
};

export async function handleJobs(
  source: string,
  keyword: string,
  jobs: any[],
  options: ScanOptions = {},
) {
  const {
    maxJobsPerSite = 10,
    maxAgeInDays,
    isManualScan = false,
    triggeringUserId,
  } = options;

  const jobsToProcess = jobs.slice(0, maxJobsPerSite);

  for (const job of jobsToProcess) {
    let jobRecord = await prisma.job.upsert({
      where: { link: job.link },
      update: {},
      create: {
        ...job,
        source,
        keyword,
      },
    });

    let targetUsers = [];

    if (isManualScan && triggeringUserId) {
      const user = await prisma.user.findUnique({
        where: { telegramId: triggeringUserId },
        include: { preferences: true },
      });
      if (user) targetUsers.push(user);
    } else {
      targetUsers = await prisma.user.findMany({
        where: {
          preferences: {
            some: { keyword },
          },
        },
        include: { preferences: true },
      });
    }

    for (const user of targetUsers) {
      const alreadyDelivered = await prisma.jobDelivery.findUnique({
        where: { jobId_userId: { jobId: jobRecord.id, userId: user.id } },
      });

      if (alreadyDelivered) continue;

      if (isManualScan && maxAgeInDays) {
        const jobAgeMs = Date.now() - jobRecord.createdAt.getTime();
        const maxAgeMs = maxAgeInDays * 24 * 60 * 60 * 1000;
        if (jobAgeMs > maxAgeMs) continue;
      }

      await processQueue.add('processJob', {
        job: jobRecord.id,
        keyword,
        isManualScan,
        triggeringUserId: user.telegramId,
      });
    }
  }
}

async function scanSite(
  siteName: 'RemoteOK' | 'WeWorkRemotely' | 'Remotive',
  fetchFn: (keyword: string) => Promise<any[]>,
  options: ScanOptions = {},
) {
  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  if (!preferences.length) return;

  const maxJobsPerSite = options.maxJobsPerSite || 10;
  let totalJobsProcessed = 0;

  for (const pref of preferences) {
    if (totalJobsProcessed >= maxJobsPerSite) break;

    try {
      const jobs = await fetchFn(pref.keyword);

      const remaining = maxJobsPerSite - totalJobsProcessed;
      const jobsToHandle = jobs.slice(0, remaining);

      await handleJobs(siteName, pref.keyword, jobsToHandle, options);

      totalJobsProcessed += jobsToHandle.length;
    } catch (error: any) {
      console.error(
        `❌ Error scanning ${siteName} for "${pref.keyword}":`,
        error.message,
      );
    }
  }
}

export async function scanRemoteOKJobs(options: ScanOptions = {}) {
  return scanSite('RemoteOK', fetchRemoteOK, options);
}

export async function scanWeWorkRemotelyJobs(options: ScanOptions = {}) {
  return scanSite('WeWorkRemotely', fetchWeWorkRemotely, options);
}

export async function scanRemotiveJobs(options: ScanOptions = {}) {
  return scanSite('Remotive', fetchRemotive, options);
}
