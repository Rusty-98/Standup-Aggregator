import { db } from '../db/client.js';
import { getOrgDate } from '../lib/dates.js';
import { logger } from '../lib/logger.js';

export interface RecapAnalysis {
  available: boolean;
  summary: string;
  shipped: string;
  blockers: string;
  unfinished: string;
  model: string | null;
  reason?: string;
}

interface StandupSlice {
  standup_date: string;
  yesterday_text: string;
  today_text: string;
  blocker_text: string;
  has_blockers: number | boolean;
  status: string;
}

function calendarDays(asOf: string, count: number): string[] {
  const [y, m, d] = asOf.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const cur = new Date(base);
    cur.setUTCDate(cur.getUTCDate() - i);
    days.push(cur.toISOString().slice(0, 10));
  }
  return days;
}

export function getPersonalWeek(userId: number, asOf: string = getOrgDate()) {
  const days = calendarDays(asOf, 7);
  const from = days[0];
  const to = days[days.length - 1];
  const rows = db.prepare(`
    SELECT * FROM standups
    WHERE user_id = ? AND standup_date >= ? AND standup_date <= ?
    ORDER BY standup_date ASC
  `).all(userId, from, to) as unknown as StandupSlice[];
  const byDate = new Map(rows.map(r => [r.standup_date, r]));
  return {
    from,
    to,
    asOf,
    days: days.map(date => ({
      date,
      standup: byDate.get(date) || null
    }))
  };
}

export async function getRecapAnalysis(userId: number): Promise<RecapAnalysis> {
  const asOf = getOrgDate();
  const cached = db.prepare(`
    SELECT summary, shipped, blockers, unfinished, model
    FROM recap_analysis
    WHERE user_id = ? AND as_of_date = ?
  `).get(userId, asOf) as RecapAnalysis | undefined;

  if (cached) {
    return { ...cached, available: true, model: cached.model };
  }

  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      available: false,
      summary: '',
      shipped: '',
      blockers: '',
      unfinished: '',
      model: null,
      reason: 'OPENAI_API_KEY is not set'
    };
  }

  const week = getPersonalWeek(userId, asOf);
  const payload = week.days.map(d => ({
    date: d.date,
    status: d.standup?.status || 'missing',
    yesterday: d.standup?.yesterday_text || '',
    today: d.standup?.today_text || '',
    blockers: d.standup?.has_blockers ? (d.standup.blocker_text || '') : ''
  }));

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = {
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You summarize one engineer\'s last 7 daily standups. Return JSON with keys summary (2-3 sentences), shipped (bullet lines), blockers (bullet lines), unfinished (bullet lines of carry-over / unchecked work). Do not invent work that is not in the source. If a day is missing, say so only in unfinished if it looks like a gap.'
      },
      {
        role: 'user',
        content: JSON.stringify(payload)
      }
    ]
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, errText }, 'OpenAI recap analysis failed');
      return {
        available: false,
        summary: '',
        shipped: '',
        blockers: '',
        unfinished: '',
        model: null,
        reason: 'AI analysis is temporarily unavailable'
      };
    }
    const json = await res.json() as any;
    const content = json.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content };
    }

    const result: RecapAnalysis = {
      available: true,
      summary: String(parsed.summary || ''),
      shipped: String(parsed.shipped || ''),
      blockers: String(parsed.blockers || ''),
      unfinished: String(parsed.unfinished || ''),
      model
    };

    db.prepare(`
      INSERT INTO recap_analysis (user_id, as_of_date, summary, shipped, blockers, unfinished, model)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, as_of_date) DO UPDATE SET
        summary = excluded.summary,
        shipped = excluded.shipped,
        blockers = excluded.blockers,
        unfinished = excluded.unfinished,
        model = excluded.model
    `).run(userId, asOf, result.summary, result.shipped, result.blockers, result.unfinished, model);

    return result;
  } catch (err: any) {
    logger.error({ err: err.message }, 'OpenAI recap analysis error');
    return {
      available: false,
      summary: '',
      shipped: '',
      blockers: '',
      unfinished: '',
      model: null,
      reason: 'AI analysis is temporarily unavailable'
    };
  }
}
