/** Team webhook must be empty or HTTPS. */
export function assertWebhook(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) {
    throw new Error('Webhook URL must start with https://');
  }
  return trimmed;
}
