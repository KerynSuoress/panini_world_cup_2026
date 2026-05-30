import { mysqlTable, int, varchar, boolean, timestamp, uniqueIndex, mysqlEnum, json } from 'drizzle-orm/mysql-core';
import type { TradeSummary } from './types';

export const profiles = mysqlTable('profiles', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('uq_email').on(t.email),
]);

export const collection = mysqlTable('collection', {
  id: int('id').autoincrement().primaryKey(),
  profileId: int('profile_id').notNull().references(() => profiles.id),
  stickerNumber: varchar('sticker_number', { length: 20 }).notNull(),
  owned: boolean('owned').notNull().default(false),
  repeats: int('repeats').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (t) => [
  uniqueIndex('uq_profile_sticker').on(t.profileId, t.stickerNumber),
]);

export const tradeRequestStatus = ['pending', 'accepted', 'declined', 'cancelled', 'expired'] as const;
export type TradeRequestStatus = (typeof tradeRequestStatus)[number];

export const tradeRequests = mysqlTable('trade_requests', {
  id: int('id').autoincrement().primaryKey(),
  initiatorId: int('initiator_id').notNull().references(() => profiles.id),
  partnerId: int('partner_id').notNull().references(() => profiles.id),
  status: mysqlEnum('status', tradeRequestStatus).notNull().default('pending'),
  initiatorGives: json('initiator_gives').$type<string[]>().notNull(),
  initiatorGets: json('initiator_gets').$type<string[]>().notNull(),
  summaryJson: json('summary_json').$type<TradeSummary>().notNull(),
  reminderPending: boolean('reminder_pending').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  expiresAt: timestamp('expires_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
});
