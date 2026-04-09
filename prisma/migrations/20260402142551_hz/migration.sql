-- AlterTable
ALTER TABLE `skill_sets` ADD COLUMN `weight_is_percent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL,
    ADD COLUMN `is_admin` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `wod_blocks` ADD COLUMN `has_gender_split` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ladder_rounds` INTEGER NULL;

-- AlterTable
ALTER TABLE `wod_exercises` ADD COLUMN `reps_female` INTEGER NULL,
    ADD COLUMN `weight_female` DECIMAL(6, 2) NULL;

-- AlterTable
ALTER TABLE `workouts` ADD COLUMN `is_club_template` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_template_only` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `show_in_leaderboard` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `user_consents` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `consent_type` VARCHAR(50) NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_consents_user_id_idx`(`user_id`),
    INDEX `user_consents_consent_type_idx`(`consent_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_consents` ADD CONSTRAINT `user_consents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
