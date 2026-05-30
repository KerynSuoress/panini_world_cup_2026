CREATE TABLE `trade_requests` (
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
--> statement-breakpoint
ALTER TABLE `trade_requests` ADD CONSTRAINT `trade_requests_initiator_id_profiles_id_fk` FOREIGN KEY (`initiator_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `trade_requests` ADD CONSTRAINT `trade_requests_partner_id_profiles_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `profiles`(`id`) ON DELETE no action ON UPDATE no action;
