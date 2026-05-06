import { db } from "../database/db.js";
import { appLogs } from "../database/schema/logs.js";

export async function addLogs(action: typeof appLogs.$inferSelect.action, id: number, name: string) {
  return await db
    .insert(appLogs)
    .values({
      action,
      userId: id,
      userName: name
    });
}