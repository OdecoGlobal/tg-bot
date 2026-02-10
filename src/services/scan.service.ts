import { prisma } from '../db/prisma';
import { processQueue } from '../queues/process.queue';
import { fetchRemoteOK } from '../scrapper/remoteok';
import { fetchWeWorkRemotely } from '../scrapper/weworkremotely';
import { fetchRemotive } from '../scrapper/remotive';

interface ScanOptions {
  maxJobsPerSite?: number;
  maxAgeInDays?: number;
  isManualScan?: boolean;
}

async function handleJobs(
  source: string,
  keyword: string,
  jobs: any[],
  options: ScanOptions = {},
) {
  const { maxJobsPerSite = 100, maxAgeInDays, isManualScan = false } = options;

  console.log(`\n📦 handleJobs called:`);
  console.log(`   Source: ${source}`);
  console.log(`   Keyword: ${keyword}`);
  console.log(`   Jobs found: ${jobs.length}`);
  console.log(`   Max jobs to process: ${maxJobsPerSite}`);
  if (maxAgeInDays) {
    console.log(`   Max age: ${maxAgeInDays} days`);
  }

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
      console.log(`   ✅ NEW JOB #${newJobsCount}: ${created.title}`);

      await processQueue.add('processJob', {
        job: created.id,
        keyword,
        isManualScan,
      });

      console.log(`   📬 Added to notification queue`);
    } else {
      if (isManualScan && maxAgeInDays) {
        const jobAge = Date.now() - exists.createdAt.getTime();
        const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000;

        if (jobAge <= maxAge) {
          console.log(
            `   📤 Existing but recent (${Math.floor(jobAge / (1000 * 60 * 60))}h old): ${job.title.substring(0, 50)}...`,
          );

          await processQueue.add('processJob', {
            job: exists.id,
            keyword,
            isManualScan,
          });
        } else {
          console.log(
            `   ⏭️  Too old (${Math.floor(jobAge / (1000 * 60 * 60 * 24))} days): ${job.title.substring(0, 50)}...`,
          );
        }
      } else {
        console.log(`   ⏭️  Already exists: ${job.title.substring(0, 50)}...`);
      }
    }
  }

  if (jobs.length > maxJobsPerSite) {
    console.log(
      `   ⚠️  Skipped ${jobs.length - maxJobsPerSite} jobs (exceeded limit)`,
    );
  }

  console.log(
    `\n📊 Summary: ${newJobsCount} new jobs, ${processedCount - newJobsCount} duplicates\n`,
  );
}

export async function scanRemoteOKJobs(options: ScanOptions = {}) {
  console.log('\n🌐 ========== REMOTEOK SCAN START ==========');
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  console.log(`📋 Found ${preferences.length} unique keywords in database`);

  if (preferences.length === 0) {
    console.log('⚠️  NO PREFERENCES FOUND!');
    console.log('========== REMOTEOK SCAN END (SKIPPED) ==========\n');
    return;
  }

  for (const pref of preferences) {
    console.log(`\n🔍 Searching RemoteOK for: "${pref.keyword}"`);
    try {
      const jobs = await fetchRemoteOK(pref.keyword);
      await handleJobs('RemoteOK', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}

export async function scanWeWorkRemotelyJobs(options: ScanOptions = {}) {
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  console.log(`📋 Found ${preferences.length} unique keywords in database`);

  if (preferences.length === 0) {
    console.log('⚠️  NO PREFERENCES FOUND!');
    console.log('========== WEWORKREMOTELY SCAN END (SKIPPED) ==========\n');
    return;
  }

  for (const pref of preferences) {
    console.log(`\n🔍 Searching WeWorkRemotely for: "${pref.keyword}"`);
    try {
      const jobs = await fetchWeWorkRemotely(pref.keyword);
      await handleJobs('WeWorkRemotely', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log('========== WEWORKREMOTELY SCAN END ==========\n');
}

export async function scanRemotiveJobs(options: ScanOptions = {}) {
  console.log('\n🎯 ========== REMOTIVE SCAN START ==========');
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  const preferences = await prisma.preference.findMany({
    distinct: ['keyword'],
  });

  console.log(`📋 Found ${preferences.length} unique keywords in database`);

  if (preferences.length === 0) {
    console.log('⚠️  NO PREFERENCES FOUND!');
    console.log('========== REMOTIVE SCAN END (SKIPPED) ==========\n');
    return;
  }

  for (const pref of preferences) {
    console.log(`\n🔍 Searching Remotive for: "${pref.keyword}"`);
    try {
      const jobs = await fetchRemotive(pref.keyword);
      await handleJobs('Remotive', pref.keyword, jobs, options);
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log('========== REMOTIVE SCAN END ==========\n');
}
