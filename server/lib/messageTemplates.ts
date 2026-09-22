export type TemplateKey = 'short' | 'standard' | 'blockers';

export const TEMPLATE_PRESETS: Record<TemplateKey, { label: string; reminder: string; digest: string }> = {
  short: {
    label: 'Short reminder',
    reminder: 'Hi {{name}}, {{team}} standup is due by {{time}}. Submit here: {{link}}',
    digest: '{{team}} standup for {{date}}. Digest is ready. {{link}}'
  },
  standard: {
    label: 'Standard standup',
    reminder: 'Hi {{name}}, please share yesterday, today, and any blockers for {{team}} before {{time}}. {{link}}',
    digest: '{{team}} daily digest for {{date}} is out. Open the team page: {{link}}'
  },
  blockers: {
    label: 'Blockers first',
    reminder: 'Hi {{name}}, if you are blocked on {{team}}, say so before {{time}}. Otherwise send today\'s plan. {{link}}',
    digest: '{{team}} blockers and updates for {{date}}: {{link}}'
  }
};

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] ?? '');
}

export function presetOrStored(stored: string, fallback: string): string {
  const text = (stored || '').trim();
  return text || fallback;
}
