CREATE TABLE `history` (
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
--> statement-breakpoint
ALTER TABLE `history` ADD CONSTRAINT `history_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_profile_time` ON `history` (`profile_id`,`occurred_at`);
