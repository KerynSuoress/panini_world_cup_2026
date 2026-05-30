-- Run this in Railway MySQL if auto-migrate did not run.
-- Railway dashboard → MySQL service → Data (or Query) → paste and execute.
-- Safe to run only once (table must not exist yet).

CREATE TABLE IF NOT EXISTS `trade_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`initiator_id` int NOT NULL,
	`partner_id` int NOT NULL,
	`status` enum('pending','accepted','declined','cancelled','expired') NOT NULL DEFAULT 'pending',
	`initiator_gives` json NOT NULL,
	`initiator_gets` json NOT NULL,
	`summary_json` json NOT NULL,
	`reminder_pending` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expires_at` timestamp NOT NULL,
	`resolved_at` timestamp,
	CONSTRAINT `trade_requests_id` PRIMARY KEY(`id`)
);

ALTER TABLE `trade_requests` ADD CONSTRAINT `trade_requests_initiator_id_profiles_id_fk` FOREIGN KEY (`initiator_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `trade_requests` ADD CONSTRAINT `trade_requests_partner_id_profiles_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;

-- Tell Drizzle this migration was applied (skip if row already exists):
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT '0700908c66e19ea096fd567facf8d1fc83e84a1c0f2349617c601f231afddafc', 1780015237700
WHERE NOT EXISTS (
  SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = '0700908c66e19ea096fd567facf8d1fc83e84a1c0f2349617c601f231afddafc'
);
