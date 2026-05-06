import { relations } from 'drizzle-orm';
import { pgTable, integer, text, PgColumn, boolean, timestamp } from 'drizzle-orm/pg-core';
import { chatTable } from './chat.js';

const sharedColumns = {
  deleted: boolean().notNull().default(false),
  updatedTime: timestamp('updated_time', {withTimezone: true}),
  createdTime: timestamp('created_time', {withTimezone: true}).notNull().defaultNow(),
};

export const employeeTable = pgTable('org_employee', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull().unique(),
  role: text({enum: ['employee', 'manager', 'admin']}).notNull().default('employee'),
  password: text().notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  ...sharedColumns,
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references((): PgColumn => employeeTable.id).notNull(),
  tokenHash: text().notNull(),
  expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  revoked: boolean().default(false).notNull(),
  replacedBy: integer().references((): PgColumn => refreshTokens.id)
});

export const emailVerificationToken = pgTable('email_verification_token', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references((): PgColumn => employeeTable.id).notNull(),
  tokenHash: text().notNull(),
  expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  revoked: boolean().default(false).notNull(),
});

export const passwordResetToken = pgTable('password_reset_token', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references((): PgColumn => employeeTable.id).notNull(),
  tokenHash: text().notNull(),
  expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  revoked: boolean().default(false).notNull(),
});

export const employeeRelations = relations(employeeTable, ({one, many}) => ({
  refreshTokens: many(employeeTable),
  chat: many(chatTable),
}));

export const refreshTokenRelations = relations(refreshTokens, ({one}) => ({
  employee: one(employeeTable, {
    relationName: 'refresh_token_employee_relation',
    fields: [refreshTokens.userId],
    references: [employeeTable.id]
  }),
}));