import { pgTable, integer, text, PgColumn, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { employeeTable } from './employee.js';
import { relations } from 'drizzle-orm';

const sharedColumns = {
  deleted: boolean().notNull().default(false),
  updatedTime: timestamp('updated_time', { withTimezone: true }),
  createdTime: timestamp('created_time', { withTimezone: true }).notNull().defaultNow(),
};

export const chatTable = pgTable('chat', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  authorId: integer('author_id').references((): PgColumn => employeeTable.id).notNull(),
  authorName: text('author_name').notNull(),
  summary: text('summary'),
  ...sharedColumns,
});

export const messagesTable = pgTable('messages', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  chatId: integer('chat_id').references((): PgColumn => chatTable.id).notNull(),
  authorId: integer('author_id').references((): PgColumn => employeeTable.id).notNull(),
  authorName: text('author_name').notNull(),
  message: text().notNull(),
  reply: text().notNull(),
  ...sharedColumns,
});

export const messageAttachment = pgTable('message_attachment', {
  id: integer().notNull().primaryKey().generatedAlwaysAsIdentity(),
  authorId: integer('author_id').references((): PgColumn => employeeTable.id).notNull(),
  authorName: text('author_name').notNull(),
  description: text(),
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  url: text(),
  ...sharedColumns,
});

export const messageAttachmentJoint = pgTable('message_attachment_joint', {
  messageId: integer('message_id').references((): PgColumn => messagesTable.id, { onDelete: 'cascade' }).notNull(),
  attachmentId: integer('attachment_id').references((): PgColumn => messageAttachment.id, { onDelete: 'cascade' }).notNull(),
  ...sharedColumns,
}, (table) => [primaryKey({ columns: [table.messageId, table.attachmentId] })]);

export const chatRelations = relations(chatTable, ({ one, many }) => ({
  messages: many(messagesTable),
}));

export const messageRelations = relations(messagesTable, ({ one, many }) => ({
  chat: one(chatTable, {
    relationName: 'messages_chat_relation',
    fields: [messagesTable.chatId],
    references: [chatTable.id],
  }),
  attachments: many(messageAttachmentJoint),
}));

export const messageAttachmentRelations = relations(messageAttachment, ({ one, many }) => ({
  messages: many(messageAttachmentJoint),
  author: one(employeeTable, {
    relationName: 'message_attachment_employee_relations',
    fields: [messageAttachment.authorId],
    references: [employeeTable.id]
  }),
}));

export const messageAttachmentJointRelations = relations(messageAttachmentJoint, ({ one, many }) => ({
  message: one(messagesTable, {
    relationName: 'attachment_joint_message_relations',
    fields: [messageAttachmentJoint.messageId],
    references: [messagesTable.id],
  }),
  attachment: one(messageAttachment, {
    relationName: 'attachment_joint_attachment_relations',
    fields: [messageAttachmentJoint.attachmentId],
    references: [messageAttachment.id]
  }),
}));