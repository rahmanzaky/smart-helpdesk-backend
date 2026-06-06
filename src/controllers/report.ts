import { db } from '../lib/database/db.js';
import { type Request, type Response } from 'express';
import { gt, lt, and, eq } from 'drizzle-orm';
import { appLogs } from '../lib/database/schema/logs.js';
import { employeeTable } from '../lib/database/schema/employee.js';
import { sendSummaryReport } from '../lib/helper/email.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildWhereClause(start?: string, end?: string) {
  const clauses: ReturnType<typeof gt>[] = [];

  clauses.push(eq(appLogs.deleted, false) as any);

  if (start) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) clauses.push(gt(appLogs.createdTime, d) as any);
  }
  if (end) {
    const d = new Date(end);
    if (!isNaN(d.getTime())) clauses.push(lt(appLogs.createdTime, d) as any);
  }

  return and(...clauses);
}

function buildSummary(logs: { action: string; userId: number; userName: string }[]) {
  const byAction: Record<string, number> = {};
  const byUserMap: Record<number, { userId: number; userName: string; count: number }> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] ?? 0) + 1;

    if (!byUserMap[log.userId]) {
      byUserMap[log.userId] = { userId: log.userId, userName: log.userName, count: 0 };
    }
    byUserMap[log.userId]!.count++;
  }

  const byUser = Object.values(byUserMap).sort((a, b) => b.count - a.count);

  return { total: logs.length, byAction, byUser };
}

function buildHtml(
  summary: ReturnType<typeof buildSummary>,
  dateRange: { start: string | null; end: string | null }
): string {
  const actionRows = Object.entries(summary.byAction)
    .map(([action, count]) => `<tr><td>${action}</td><td>${count}</td></tr>`)
    .join('');

  const userRows = summary.byUser
    .slice(0, 10)
    .map((u) => `<tr><td>${u.userName}</td><td>${u.count}</td></tr>`)
    .join('');

  return `
    <h2>Smart Helpdesk Activity Report</h2>
    <p><strong>Date range:</strong> ${dateRange.start ?? 'all time'} &mdash; ${dateRange.end ?? 'now'}</p>
    <p><strong>Total activity:</strong> ${summary.total}</p>

    <h3>Breakdown by action</h3>
    <table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>Action</th><th>Count</th></tr></thead>
      <tbody>${actionRows}</tbody>
    </table>

    <h3>Top users</h3>
    <table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>User</th><th>Count</th></tr></thead>
      <tbody>${userRows}</tbody>
    </table>
  `;
}

// ── GET /api/v1/generate-report ───────────────────────────────────────────────

export async function getReport(req: Request, res: Response) {
  if (!req.user) return res.sendStatus(401);

  const start = typeof req.query.s === 'string' ? req.query.s : undefined;
  const end = typeof req.query.e === 'string' ? req.query.e : undefined;

  try {
    const logs = await db.select().from(appLogs).where(buildWhereClause(start, end));
    const summary = buildSummary(logs);

    return res.status(200).json({
      data: {
        logs,
        summary,
        dateRange: { start: start ?? null, end: end ?? null },
      },
    });
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
}

// ── POST /api/v1/generate-report ──────────────────────────────────────────────

export async function sendReport(req: Request, res: Response) {
  if (!req.user) return res.sendStatus(401);

  const start: string | undefined = req.body?.start;
  const end: string | undefined = req.body?.end;

  try {
    const [employee] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, req.user.id));

    if (!employee) return res.status(400).json({ error: 'User not found' });

    const logs = await db.select().from(appLogs).where(buildWhereClause(start, end));
    const summary = buildSummary(logs);
    const dateRange = { start: start ?? null, end: end ?? null };
    const htmlContent = buildHtml(summary, dateRange);

    const { error } = await sendSummaryReport(employee.email, htmlContent);
    if (error) {
      return res.status(500).json({ error: 'Failed to send summary report email' });
    }

    return res.status(200).json({ success: true, message: `Report sent to ${employee.email}` });
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
}
