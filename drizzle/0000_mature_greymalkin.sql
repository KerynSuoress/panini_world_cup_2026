CREATE TABLE `collection` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profile_id` int NOT NULL,
	`sticker_number` varchar(20) NOT NULL,
	`owned` boolean NOT NULL DEFAULT false,
	`repeats` int NOT NULL DEFAULT 0,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_profile_sticker` UNIQUE(`profile_id`,`sticker_number`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_email` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `collection` ADD CONSTRAINT `collection_profile_id_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;