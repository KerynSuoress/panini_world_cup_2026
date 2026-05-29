import { mysqlTable, int, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core';

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
