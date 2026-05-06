import { relations } from 'drizzle-orm';
import { pgTable, integer, text, PgColumn, boolean, timestamp } from 'drizzle-orm/pg-core';
import { chatTable } from './chat.js';
import { employeeTable } from './employee.js';

const sharedColumns = {
  deleted: boolean().notNull().default(false),
  updatedTime: timestamp('updated_time', { withTimezone: true }),
  createdTime: timestamp('created_time', { withTimezone: true }).notNull().defaultNow(),
};

const appLogs = pgTable('app_logs', {
  id: integer().primaryKey().notNull().generatedAlwaysAsIdentity(),
  action: text({enum: ['REGISTER', 'LOGIN', 'LOGOUT', 'PASSWORD', 'CHAT', 'MESSAGE', 'ATTACHMENT', 'REPORT']}).notNull(),
  userId: integer('user_id').references((): PgColumn => employeeTable.id).notNull(),
  userName: text('user_name').notNull(),
  ...sharedColumns
});

export { appLogs }