import { Worker, Queue } from 'bullmq';
import { prisma } from '../db/prisma';
import { connection } from '../lib/constants';

const cleanupQueue = new Queue('cleanupQueue', { connection });

new Worker(
  'cleanupQueue',
  async () => {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.jobDelivery.deleteMany({
      where: { job: { createdAt: { lt: cutoff } } },
    });
    await prisma.job.deleteMany({ where: { createdAt: { lt: cutoff } } });
    console.log('✅ Old jobs and deliveries cleaned up');
  },
  { connection, concurrency: 1 },
);

cleanupQueue.add('dailyCleanup', {}, { repeat: { pattern: '0 3 * * *' } });
