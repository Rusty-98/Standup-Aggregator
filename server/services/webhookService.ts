import { logger } from '../lib/logger.js';

export async function postTeamWebhook(url: string, text: string): Promise<void> {
  const hook = (url || '').trim();
  if (!hook) return;
  if (!hook.startsWith('https://')) {
    throw new Error('Webhook URL must start with https://');
  }

  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error({ status: res.status, body: body.slice(0, 200) }, 'Team webhook post failed');
    throw new Error(`Webhook returned ${res.status}`);
  }
}
