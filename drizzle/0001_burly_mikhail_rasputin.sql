CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trainingId` int NOT NULL,
	`evaluatorId` int NOT NULL,
	`assignedById` int NOT NULL,
	`assignedAt` datetime NOT NULL,
	`dueDate` datetime NOT NULL,
	`status` enum('PENDING','DRAFT','COMPLETED','OVERDUE','REOPENED') NOT NULL DEFAULT 'PENDING',
	`completedAt` datetime,
	`reopenedAt` datetime,
	`reopenedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_assignment_training_evaluator` UNIQUE(`trainingId`,`evaluatorId`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`oldValue` json,
	`newValue` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`description` text,
	`controlPoints` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `criteria_id` PRIMARY KEY(`id`),
	CONSTRAINT `criteria_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `evaluationResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluationId` int NOT NULL,
	`criterionId` int NOT NULL,
	`score` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluationResponses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_response_evaluation_criterion` UNIQUE(`evaluationId`,`criterionId`)
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`evaluatorId` int NOT NULL,
	`trainingId` int NOT NULL,
	`status` enum('DRAFT','COMPLETED') NOT NULL DEFAULT 'DRAFT',
	`generalComment` text,
	`totalScore` int,
	`averageScore` double,
	`successPercentage` double,
	`successStatus` enum('SUCCESSFUL','UNSUCCESSFUL'),
	`submittedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `evaluations_assignmentId_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(300) NOT NULL,
	`message` text NOT NULL,
	`link` varchar(500),
	`relatedEntityType` varchar(64),
	`relatedEntityId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` datetime NOT NULL,
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `trainings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`trainingType` varchar(120),
	`targetAudience` varchar(500),
	`learningObjectives` text,
	`durationMinutes` int,
	`contentOwner` varchar(200),
	`trainingUrl` varchar(2048),
	`fileUrl` varchar(2048),
	`imageUrl` varchar(2048),
	`version` varchar(64) NOT NULL DEFAULT '1.0',
	`publishDate` datetime,
	`lastUpdatedDate` datetime,
	`evaluationStartDate` datetime,
	`evaluationEndDate` datetime,
	`status` enum('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainings_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainings_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(201);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) NOT NULL DEFAULT 'password';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('ADMIN','EVALUATOR') NOT NULL DEFAULT 'EVALUATOR';--> statement-breakpoint
ALTER TABLE `users` ADD `firstName` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastName` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLoginAt` datetime;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_trainingId_trainings_id_fk` FOREIGN KEY (`trainingId`) REFERENCES `trainings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_evaluatorId_users_id_fk` FOREIGN KEY (`evaluatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_assignedById_users_id_fk` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_reopenedById_users_id_fk` FOREIGN KEY (`reopenedById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationResponses` ADD CONSTRAINT `evaluationResponses_evaluationId_evaluations_id_fk` FOREIGN KEY (`evaluationId`) REFERENCES `evaluations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluationResponses` ADD CONSTRAINT `evaluationResponses_criterionId_criteria_id_fk` FOREIGN KEY (`criterionId`) REFERENCES `criteria`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_assignmentId_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_evaluatorId_users_id_fk` FOREIGN KEY (`evaluatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_trainingId_trainings_id_fk` FOREIGN KEY (`trainingId`) REFERENCES `trainings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainings` ADD CONSTRAINT `trainings_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_assignment_evaluator_status` ON `assignments` (`evaluatorId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_assignment_due` ON `assignments` (`dueDate`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_evaluation_training_status` ON `evaluations` (`trainingId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_notification_user_read` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_training_status` ON `trainings` (`status`);--> statement-breakpoint
CREATE INDEX `idx_training_dates` ON `trainings` (`evaluationEndDate`);