import { db } from '../lib/database/db.js';
import { type NextFunction, type Request, type Response } from 'express';
import { gt, lt, and, eq, ne, desc, sql } from 'drizzle-orm';
import { chatTable, messageAttachment, messageAttachmentJoint, messagesTable } from '../lib/database/schema/chat.js';
import { employeeTable } from '../lib/database/schema/employee.js';
import { uploadToR2Buffer } from '../lib/helper/image.js';
import Busboy from 'busboy';
import { addLogs } from '../lib/helper/logs.js';
import { appLogs } from '../lib/database/schema/logs.js';
import { sendSummaryReport } from '../lib/helper/email.js';

export async function createReport(req: Request, res: Response) {
  if (!req.user ) {
    return res.sendStatus(401);
  }

  const params = req.query;
  const whereClause: any[] = [];
  try {
    if (params.s && typeof params.s === 'string') {
      const startDate = new Date(params.s);
      if (!isNaN(startDate.getTime())) {
        whereClause.push(gt(appLogs.createdTime, startDate));
      }
    }

    if (params.e && typeof params.e === 'string') {
      const endDate = new Date(params.e);
      if (!isNaN(endDate.getTime())) {
        whereClause.push(lt(appLogs.createdTime, endDate));
      }
    }

    const logs = await db.select().from(appLogs).where(and(...whereClause));

    //report values


    const [u] = await db.select().from(employeeTable).where(eq(employeeTable.id, req.user.id));
    if (!u) {
      return res.status(400);
    }

    const { data, error } = await sendSummaryReport(u.email, logs.length);
    if (error) {
       return res.status(500).send({ error: 'failed to send summary report email' });
    }

    return res.status(200).send(params)
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
}
