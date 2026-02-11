import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../db/prisma';
import { processQueue } from '../queues/process.queue';

const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID!;

export const telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
  polling: {
    interval: 300,
    autoStart: false,
    params: {
      timeout: 10,
    },
  },
});

async function removeUserJobs(userId: string) {
  const jobs = await processQueue.getJobs(['delayed', 'wait', 'active']);
  for (const job of jobs) {
    if (job.data.triggeringUserId === userId) {
      await job.remove();
    }
  }
}

telegramBot.on('polling_error', (error: any) => {
  console.error('❌ Polling error:', error.code, error.message);

  if (error.code === 'EFATAL') {
    console.error('🔄 EFATAL detected - attempting recovery...');

    telegramBot
      .stopPolling()
      .then(() => {
        console.log('✅ Polling stopped');

        setTimeout(() => {
          telegramBot
            .startPolling({ restart: true })
            .then(() => console.log('✅ Polling restarted successfully'))
            .catch(err => console.error('❌ Failed to restart polling:', err));
        }, 5000);
      })
      .catch(err => {
        console.error('❌ Error stopping polling:', err);
      });
  }
});

telegramBot.on('error', (error: any) => {
  console.error('❌ Bot error:', error);
});

telegramBot.on('webhook_error', (error: any) => {
  console.error('❌ Webhook error:', error);
});

export async function setupCommands() {
  await telegramBot.setMyCommands([
    {
      command: 'start',
      description: 'Start the bot and subscribe to job alerts',
    },
    { command: 'stop', description: 'Unsubscribe from job alerts' },
    { command: 'set', description: 'Set your job search keyword' },
    { command: 'preferences', description: 'View your preferences' },
    { command: 'clear', description: 'Clear all preferences' },
    { command: 'scan', description: 'Manually trigger a job scan' },
  ]);

  await telegramBot.setMyCommands(
    [
      {
        command: 'start',
        description: 'Start the bot and subscribe to job alerts',
      },
      { command: 'stop', description: 'Unsubscribe from job alerts' },
      { command: 'set', description: 'Set your job search keyword' },
      { command: 'preferences', description: 'View your preferences' },
      { command: 'clear', description: 'Clear all preferences' },
      { command: 'scan', description: 'Manually trigger a job scan' },
      { command: 'debug', description: 'Debug info' },
    ],
    { scope: { type: 'chat', chat_id: ADMIN_TELEGRAM_CHAT_ID } },
  );
}

telegramBot.onText(/\/start/, async msg => {
  const chatId = msg.chat.id.toString();

  await prisma.user.upsert({
    where: { telegramId: chatId },
    update: { active: true },
    create: { telegramId: chatId, name: msg.from?.first_name, active: true },
  });

  await telegramBot.sendMessage(
    chatId,
    `🎉 Welcome to Job Bot!\n\n` +
      `Send me job keywords you're interested in (e.g., 'react', 'python')\n\n` +
      `Commands:\n` +
      `/start - Start the bot\n` +
      `/stop - Unsubscribe\n` +
      `/set - Add keyword\n` +
      `/preferences - View preferences\n` +
      `/clear - Clear preferences\n` +
      `/scan - Manually scan jobs\n` +
      `${chatId === ADMIN_TELEGRAM_CHAT_ID && '/debug - View system stats (admin only)'}`,
  );
});

telegramBot.onText(/\/stop/, async msg => {
  const chatId = msg.chat.id.toString();

  await prisma.user.updateMany({
    where: { telegramId: chatId },
    data: { active: false },
  });

  await removeUserJobs(chatId);

  await telegramBot.sendMessage(
    chatId,
    '🛑 You have unsubscribed from job alerts. You can /start anytime to re-subscribe.',
  );
});

telegramBot.onText(/\/preferences/, async msg => {
  const chatId = msg.chat.id.toString();

  const user = await prisma.user.findUnique({
    where: { telegramId: chatId },
    include: { preferences: true },
  });

  if (!user?.preferences || user.preferences.length === 0) {
    await telegramBot.sendMessage(
      chatId,
      "You don't have any preferences set yet.\n\nJust send me keywords like 'react' or 'python'! or use /set <keyword>",
    );
    return;
  }

  const keywords = user.preferences.map(p => p.keyword).join(', ');
  await telegramBot.sendMessage(
    chatId,
    `📋 Your job preferences:\n${keywords}\n\nSend new keywords to add more!`,
  );
});

telegramBot.onText(/\/clear/, async msg => {
  const chatId = msg.chat.id.toString();

  await prisma.preference.deleteMany({
    where: {
      user: { telegramId: chatId },
    },
  });

  await removeUserJobs(chatId);

  await telegramBot.sendMessage(chatId, '✅ All preferences cleared!');
});

telegramBot.onText(/\/scan/, async msg => {
  const chatId = msg.chat.id.toString();
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId },
      include: { preferences: true },
    });

    if (!user || !user.preferences.length) {
      await telegramBot.sendMessage(
        chatId,
        '⚠️ You have no scan preferences set!\n\nPlease add at least one keyword with /set <keyword> before scanning.',
      );
      return;
    }

    await telegramBot.sendMessage(
      chatId,
      '🔍 Scanning...\n\n' +
        '• Max 10 jobs per site\n' +
        '• Jobs from last 2 days only\n\n' +
        'This may take a moment...',
    );

    const { scanRemoteOKJobs, scanWeWorkRemotelyJobs, scanRemotiveJobs } =
      await import('../services/scan.service');

    const scanOptions = {
      maxJobsPerSite: 10,
      maxAgeInDays: 2,
      isManualScan: true,
      triggeringUserId: chatId,
    };

    await scanRemoteOKJobs(scanOptions);
    await scanWeWorkRemotelyJobs(scanOptions);
    await scanRemotiveJobs(scanOptions);

    const jobCount = await prisma.job.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      },
    });

    await telegramBot.sendMessage(
      chatId,
      `✅ Manual scan completed!\n\n📊 Found ${jobCount} jobs from the last 2 days.`,
    );
  } catch (error) {
    console.error('Error during manual scan:', error);
    await telegramBot.sendMessage(
      chatId,
      '❌ Error during scan. Try again later',
    );
  }
});

telegramBot.onText(/\/debug/, async msg => {
  const chatId = msg.chat.id.toString();
  if (chatId !== ADMIN_TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId },
      include: { preferences: true },
    });

    const allUsers = await prisma.user.count();
    const allPrefs = await prisma.preference.count();
    const allJobs = await prisma.job.count();

    const recentJobs = await prisma.job.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { title: true, source: true, keyword: true, createdAt: true },
    });

    let message = `🔍 *Stat Info*\n\n`;
    message += `*Your Data:*\n`;
    message += `• User ID: ${user?.id || 'Not found'}\n`;
    message += `• Preferences: ${user?.preferences.length || 0}\n`;

    if (user?.preferences && user.preferences.length > 0) {
      user.preferences.forEach(p => {
        message += `  - ${p.keyword}\n`;
      });
    }

    message += `\n*System Stats:*\n`;
    message += `• Total Users: ${allUsers}\n`;
    message += `• Total Preferences: ${allPrefs}\n`;
    message += `• Total Jobs in DB: ${allJobs}\n`;

    if (recentJobs.length > 0) {
      message += `\n*Last ${recentJobs.length} Jobs Found:*\n`;
      recentJobs.forEach(j => {
        const timeAgo = Math.floor(
          (Date.now() - j.createdAt.getTime()) / 60000,
        );
        message += `• ${j.title.substring(0, 40)}...\n`;
        message += `  ${j.source} | ${j.keyword} | ${timeAgo}m ago\n`;
      });
    } else {
      message += `\n⚠️ No jobs found yet!\n`;
    }

    await telegramBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in debug command:', error);
    await telegramBot.sendMessage(chatId, '❌ Error fetching debug info');
  }
});

telegramBot.on('message', async msg => {
  const chatId = msg.chat.id.toString();
  let text = msg.text?.trim();

  if (!text) return;

  if (text.startsWith('/set')) {
    text = text.replace(/^\/set\s*/i, '').trim();

    if (!text) {
      return telegramBot.sendMessage(
        chatId,
        '❌ Please provide at least one keyword.\n\nUsage: /set react python\n\nOr just send keywords directly without any command!',
      );
    }
  } else if (text.startsWith('/')) {
    return;
  }

  const keywords = text
    .split(/[\s,]+/)
    .map(k => k.toLowerCase())
    .filter(k => k.length > 0);
  if (keywords.length === 0) {
    return;
  }

  const user = await prisma.user.upsert({
    where: { telegramId: chatId },
    update: {},
    create: { telegramId: chatId, name: msg.from?.first_name, active: true },
  });

  const added: string[] = [];
  const alreadyTracking: string[] = [];

  for (const keyword of keywords) {
    const existing = await prisma.preference.findFirst({
      where: { userId: user.id, keyword },
    });

    if (existing) {
      alreadyTracking.push(keyword);
    } else {
      await prisma.preference.create({
        data: { userId: user.id, keyword },
      });
      added.push(keyword);
    }
  }

  let response = '';

  if (added.length > 0) {
    response += `✅ Added: ${added.join(', ')}\n\nI'll notify you about new jobs for these keywords.`;
  }

  if (alreadyTracking.length > 0) {
    if (response) response += '\n\n';
    response += `ℹ️ Already tracking: ${alreadyTracking.join(', ')}`;
  }

  if (response) {
    await telegramBot.sendMessage(chatId, response);
  }
});

export async function sendTelegramMessage(
  chatId: string | number,
  message: string,
) {
  try {
    await telegramBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`Failed to send message to ${chatId}:`, error);
  }
}

setTimeout(() => {
  telegramBot
    .startPolling({ restart: true })
    .then(() => {
      console.log('✅ Telegram bot polling started successfully');
    })
    .catch(err => {
      console.error('❌ Failed to start polling:', err);
    });
}, 2000);

setupCommands().then(() => console.log('✅ Telegram commands configured'));
