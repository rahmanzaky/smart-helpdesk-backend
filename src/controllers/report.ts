import { db } from '../lib/database/db.js';
import { type Request, type Response } from 'express';
import { gt, lt, and, eq } from 'drizzle-orm';
import { appLogs } from '../lib/database/schema/logs.js';
import { employeeTable } from '../lib/database/schema/employee.js';
import { chatTable } from '../lib/database/schema/chat.js';
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

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CHAT: 'Sesi Chat Dibuat',
  MESSAGE: 'Pesan Dikirim',
  ATTACHMENT: 'Foto/Dokumen Dilampirkan',
  PASSWORD: 'Reset Password',
  REGISTER: 'Registrasi Akun',
};

function buildHtml(
  summary: ReturnType<typeof buildSummary>,
  dateRange: { start: string | null; end: string | null },
  chatSessions: { title: string; authorName: string; summary: string | null; createdTime: Date }[]
): string {
  const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const startLabel = dateRange.start ? fmt(new Date(dateRange.start)) : 'Semua waktu';
  const endLabel = dateRange.end ? fmt(new Date(dateRange.end)) : fmt(new Date());

  const sessions = summary.byAction['CHAT'] ?? 0;
  const messages = summary.byAction['MESSAGE'] ?? 0;
  const attachments = summary.byAction['ATTACHMENT'] ?? 0;
  const logins = summary.byAction['LOGIN'] ?? 0;
  const avgMsg = sessions > 0 ? (messages / sessions).toFixed(1) : '0';
  const attachPct = sessions > 0 ? Math.round((attachments / sessions) * 100) : 0;

  const metricCard = (value: string | number, label: string, color: string) => `
    <td style="width:25%;padding:0 8px;">
      <div style="background:#f8fafc;border-radius:12px;padding:20px 16px;text-align:center;border-top:3px solid ${color};">
        <div style="font-size:28px;font-weight:900;color:#1a1a2e;">${value}</div>
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${label}</div>
      </div>
    </td>`;

  const actionRows = Object.entries(summary.byAction)
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151;">
          ${ACTION_LABELS[action] ?? action}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#004aad;text-align:right;">
          ${count}
        </td>
      </tr>`).join('');

  const userRows = summary.byUser.slice(0, 10).map((u, i) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151;">
        <span style="display:inline-block;width:22px;height:22px;background:#e0e7ff;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#004aad;margin-right:8px;">${i + 1}</span>
        ${u.userName}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#004aad;text-align:right;">
        ${u.count} aktivitas
      </td>
    </tr>`).join('');

  const summaryCards = chatSessions
    .filter(c => c.summary)
    .slice(0, 5)
    .map(c => {
      let parsed: any = null;
      try { parsed = JSON.parse(c.summary!); } catch {}
      if (!parsed) return '';
      const categoryColors: Record<string, string> = {
        'Printing Quality': '#f59e0b',
        'Defect Part': '#ef4444',
        'General Guidance': '#10b981',
        'Not Applicable': '#6b7280',
      };
      const catColor = categoryColors[parsed.category] ?? '#6b7280';
      return `
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:12px;border-left:4px solid ${catColor};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1a1a2e;">${c.title}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${c.authorName} · ${fmt(new Date(c.createdTime))}</div>
            </div>
            <span style="background:${catColor}20;color:${catColor};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;white-space:nowrap;margin-left:12px;">${parsed.category}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:10px;">
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;">Masalah</div>
                <div style="font-size:13px;color:#374151;">${parsed.reported_issue}</div>
              </td>
              <td style="width:50%;vertical-align:top;padding-left:10px;border-left:1px solid #e5e7eb;">
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;margin-bottom:4px;">Solusi</div>
                <div style="font-size:13px;color:#374151;">${parsed.solution}</div>
              </td>
            </tr>
          </table>
        </div>`;
    }).join('');

  const hasSummaries = summaryCards.length > 0;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#004aad;padding:32px 40px;">
      <div style="font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">LAPORAN AKTIVITAS</div>
      <div style="font-size:26px;font-weight:900;color:#ffffff;line-height:1.2;">SEJAHE Smart Helpdesk</div>
      <div style="font-size:13px;color:#bfdbfe;margin-top:8px;">PT. Indonesia Epson Industry &nbsp;·&nbsp; ${startLabel} — ${endLabel}</div>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">

      <!-- Metric cards -->
      <div style="margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;">Ringkasan Periode</div>
        <table style="width:100%;border-collapse:collapse;margin:0 -8px;">
          <tr>
            ${metricCard(sessions, 'Sesi Chat', '#004aad')}
            ${metricCard(messages, 'Pesan Terkirim', '#10b981')}
            ${metricCard(avgMsg, 'Rata-rata Pesan/Sesi', '#f59e0b')}
            ${metricCard(attachPct + '%', 'Sesi dengan Foto', '#8b5cf6')}
          </tr>
        </table>
      </div>

      <!-- Activity breakdown -->
      <div style="margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;">Detail Aktivitas</div>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#e0e7ff;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#004aad;text-transform:uppercase;">Jenis Aktivitas</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#004aad;text-transform:uppercase;">Jumlah</th>
            </tr>
          </thead>
          <tbody>${actionRows}</tbody>
        </table>
      </div>

      <!-- Top users -->
      <div style="margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;">Teknisi Teraktif</div>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#e0e7ff;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#004aad;text-transform:uppercase;">Nama Teknisi</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#004aad;text-transform:uppercase;">Total Aktivitas</th>
            </tr>
          </thead>
          <tbody>${userRows}</tbody>
        </table>
      </div>

      ${hasSummaries ? `
      <!-- Chat summaries -->
      <div style="margin-bottom:28px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;">Ringkasan Isu Terbaru (${chatSessions.filter(c => c.summary).length} sesi dianalisis)</div>
        ${summaryCards}
      </div>` : ''}

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:12px;color:#9ca3af;">Laporan ini dibuat otomatis oleh <strong>SEJAHE</strong> · PT. Indonesia Epson Industry</div>
      <div style="font-size:11px;color:#d1d5db;margin-top:4px;">Dikirim pada ${fmt(new Date())}</div>
    </div>

  </div>
</body>
</html>`;
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

    const chatSessions = await db
      .select({
        title: chatTable.title,
        authorName: chatTable.authorName,
        summary: chatTable.summary,
        createdTime: chatTable.createdTime,
      })
      .from(chatTable)
      .where(eq(chatTable.deleted, false));

    const htmlContent = buildHtml(summary, dateRange, chatSessions as any);

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
