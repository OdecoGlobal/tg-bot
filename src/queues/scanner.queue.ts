import { connection } from '../lib/constants';
import { Queue } from 'bullmq';

export const scannerQueue = new Queue('scannerQueue', { connection });

export async function registerScheduler() {
  await scannerQueue.add('scanAll', {}, { repeat: { pattern: '*/5 * * * *' } });
}

// await scannerQueue.add(
//   'scanIndeed',
//   {},
// { repeat: { pattern: '*/5 * * * *' } }
// );
// await scannerQueue.add(
//   'scanWeWorkRemotely',
//   {},
//   { repeat: { pattern: '*/5 * * * *' } },
// );
