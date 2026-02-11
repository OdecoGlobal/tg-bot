import { prisma } from '../db/prisma';
import { processQueue } from '../queues/process.queue';
import { fetchRemoteOK } from '../scrapper/remoteok';
import { fetchWeWorkRemotely } from '../scrapper/weworkremotely';
import { fetchRemotive } from '../scrapper/remotive';

interface ScanOptions {
  maxJobsPerSite?: number;
  maxAgeInDays?: number;
  isManualScan?: boolean;
  triggeringUserId?: string;
}

async function handleJobs(
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

  let newJobsCount = 0;
  let processedCount = 0;

  const jobsToProcess = jobs.slice(0, maxJobsPerSite);

  for (const job of jobsToProcess) {
    processedCount++;

    const exists = await prisma.job.findUnique({
      where: { link: job.link },
    });

    if (!exists) {
      const created = await prisma.job.create({
        data: {
          ...job,
          source,
          keyword,
        },
      });

      newJobsCount++;

      await processQueue.add('processJob', {
        job: created.id,
        keyword,
        isManualScan,
        triggeringUserId,
      });
    } else {
      if (isManualScan && maxAgeInDays) {
        const jobAge = Date.now() - exists.createdAt.getTime();
        const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000;

        if (jobAge <= maxAge) {
          await processQueue.add('processJob', {
            job: exists.id,
            keyword,
            isManualScan,
            triggeringUserId,
          });
        }
      }
    }
  }

  if (jobs.length > maxJobsPerSite) {
  }
}

export async function scanRemoteOKJobs(options: ScanOptions = {}) {
  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  if (preferences.length === 0) {
    return;
  }

  for (const pref of preferences) {
    try {
      const jobs = await fetchRemoteOK(pref.keyword);
      await handleJobs('RemoteOK', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}

export async function scanWeWorkRemotelyJobs(options: ScanOptions = {}) {
  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  if (preferences.length === 0) {
    return;
  }

  for (const pref of preferences) {
    try {
      const jobs = await fetchWeWorkRemotely(pref.keyword);
      await handleJobs('WeWorkRemotely', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}

export async function scanRemotiveJobs(options: ScanOptions = {}) {
  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  if (preferences.length === 0) {
    return;
  }

  for (const pref of preferences) {
    try {
      const jobs = await fetchRemotive(pref.keyword);
      await handleJobs('Remotive', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}
