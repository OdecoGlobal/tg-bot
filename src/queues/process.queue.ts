import { connection } from '../lib/constants';
import { Queue } from 'bullmq';

export const processQueue = new Queue('processQueue', { connection });
