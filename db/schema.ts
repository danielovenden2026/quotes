import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const quotes = sqliteTable('quotes', {
 id: text('id').primaryKey(),
 owner: text('owner').notNull(),
 version: integer('version').notNull().default(1),
 data: text('data').notNull(),
 updated: text('updated').notNull(),
}, (table) => [index('idx_quotes_owner_updated').on(table.owner, table.updated)]);
