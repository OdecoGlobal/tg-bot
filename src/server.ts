process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

import app from './app';

import { registerScheduler } from './queues/scanner.queue';

import './bot/telegram';
import './workers/process.worker';
import './workers/scanner.worker';

const PORT = process.env.PORT || 7000;

const server = app.listen(PORT, async () => {
  console.log(`App listening on port ${PORT}`);
  await registerScheduler();
});

process.on('unhandledRejection', (err: Error) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message, err.stack);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
