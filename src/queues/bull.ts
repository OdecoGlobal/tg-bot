import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!);
export const jobQueue = new Queue("jobQueue", { connection });

export const jobWorker = new Worker(
  "jobQueue",
  async (job) => {
    const { jobData } = job.data;
    // TODO: Analyze job + optimize resume + send notifications
    console.log("Processing job:", jobData.title);
  },
  { connection },
);
