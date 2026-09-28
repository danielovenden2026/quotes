import { index, uniqueIndex, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const quotes = sqliteTable('quotes', {
 id: text('id').primaryKey(),
 owner: text('owner').notNull(),
 version: integer('version').notNull().default(1),
 data: text('data').notNull(),
 updated: text('updated').notNull(),
}, (table) => [index('idx_quotes_owner_updated').on(table.owner, table.updated)]);
export const adhocProducts = sqliteTable('adhoc_products', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), quoteId: text('quote_id').notNull(),
 sku: text('sku').notNull(), name: text('name').notNull(), cost: integer('cost').notNull(),
 price: integer('price').notNull(), qty: integer('qty').notNull(),
 imageKey: text('image_key'), imageType: text('image_type'),
 sourceSku: text('source_sku'), costFromFeed: integer('cost_from_feed').notNull().default(0),
 imagesJson: text('images_json'), familyId: text('family_id'), created: text('created').notNull(),
}, table => [index('idx_adhoc_quote_owner').on(table.quoteId, table.owner)]);
export const workspaceUsers = sqliteTable('workspace_users', {
 email:text('email').primaryKey(), userId:text('user_id').unique(), name:text('name').notNull(),
 phone:text('phone').notNull().default(''), mobile:text('mobile').notNull().default(''),
 permissions:text('permissions').notNull(), active:integer('active').notNull().default(1),
 passwordHash:text('password_hash').notNull().default(''), passwordSalt:text('password_salt').notNull().default(''),
 passwordIterations:integer('password_iterations').notNull().default(0),
 version:integer('version').notNull().default(1), updated:text('updated').notNull(), updatedBy:text('updated_by').notNull(),
});

export const verificationChallenges=sqliteTable('verification_challenges',{
 userId:text('user_id').primaryKey(), sid:text('sid').notNull().default(''), channel:text('channel').notNull(),
 userVersion:integer('user_version').notNull(), expires:integer('expires').notNull(),
 attempts:integer('attempts').notNull().default(0), consumed:integer('consumed').notNull().default(0),
 sends:integer('sends').notNull(), windowStart:integer('window_start').notNull(), lastSent:integer('last_sent').notNull(),
});
export const verificationSessions=sqliteTable('verification_sessions',{
 hash:text('hash').primaryKey(), userId:text('user_id').notNull(), userVersion:integer('user_version').notNull(), expires:integer('expires').notNull(),
});

// Sandbox transactions are separate from quotes: a test never marks a quote paid.
export const ewayTestPayments=sqliteTable('eway_test_payments',{
 id:text('id').primaryKey(), quoteId:text('quote_id').notNull(), quoteVersion:integer('quote_version').notNull(),
 amount:integer('amount').notNull(), invoice:text('invoice').notNull(), connection:text('connection').notNull(),
 status:text('status').notNull(), accessCode:text('access_code'), paymentUrl:text('payment_url'),
 transactionId:text('transaction_id'), responseCode:text('response_code'), created:text('created').notNull(), updated:text('updated').notNull(),
},table=>[uniqueIndex('idx_eway_test_quote_version').on(table.quoteId,table.quoteVersion)]);

export const workspaceSessions=sqliteTable('workspace_sessions',{hash:text('hash').primaryKey(),userId:text('user_id').notNull(),userVersion:integer('user_version').notNull(),expires:integer('expires').notNull(),created:integer('created').notNull()},table=>[index('idx_workspace_sessions_user').on(table.userId),index('idx_workspace_sessions_expiry').on(table.expires)]);
export const authLoginAttempts=sqliteTable('auth_login_attempts',{email:text('email').primaryKey(),attempts:integer('attempts').notNull().default(0),windowStart:integer('window_start').notNull(),lockedUntil:integer('locked_until').notNull().default(0)});
