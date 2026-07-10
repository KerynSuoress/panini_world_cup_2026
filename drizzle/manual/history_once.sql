-- Run this in Railway MySQL if auto-migrate did not create `history`.
-- Railway dashboard → MySQL service → Data (or Query) → paste and execute.
-- Safe to run only once (table must not exist yet).

CREATE TABLE IF NOT EXISTS `history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profile_id` int NOT NULL,
	`sticker_number` varchar(20) NOT NULL,
	`action` enum('owned_on','owned_off','repeat_add','repeat_remove') NOT NULL,
	`old_owned` boolean NOT NULL DEFAULT false,
	`new_owned` boolean NOT NULL DEFAULT false,
	`old_repeats` int NOT NULL DEFAULT 0,
	`new_repeats` int NOT NULL DEFAULT 0,
	`occurred_at` timestamp DEFAULT (now()),
	CONSTRAINT `history_id` PRIMARY KEY(`id`)
);

ALTER TABLE `history` ADD CONSTRAINT `history_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;

CREATE INDEX `idx_profile_time` ON `history` (`profile_id`,`occurred_at`);

-- Tell Drizzle this migration was applied (skip if row already exists):
INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT 'f20b9c6336b504c0d2cd6f73ebb0c788f6fc8dea4b791deb1bc5946b648d0271', 1752112800000
WHERE NOT EXISTS (
  SELECT 1 FROM `__drizzle_migrations` WHERE `hash` = 'f20b9c6336b504c0d2cd6f73ebb0c788f6fc8dea4b791deb1bc5946b648d0271'
);
