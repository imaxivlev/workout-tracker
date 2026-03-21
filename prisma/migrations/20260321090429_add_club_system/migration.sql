-- CreateTable
CREATE TABLE `clubs` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `logo` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clubs_slug_key`(`slug`),
    INDEX `clubs_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `club_members` (
    `id` VARCHAR(36) NOT NULL,
    `club_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'COACH', 'ATHLETE') NOT NULL DEFAULT 'ATHLETE',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `club_members_club_id_idx`(`club_id`),
    INDEX `club_members_user_id_idx`(`user_id`),
    UNIQUE INDEX `club_members_club_id_user_id_key`(`club_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `club_invites` (
    `id` VARCHAR(36) NOT NULL,
    `club_id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `max_uses` INTEGER NULL,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `club_invites_code_key`(`code`),
    INDEX `club_invites_code_idx`(`code`),
    INDEX `club_invites_club_id_idx`(`club_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `club_members` ADD CONSTRAINT `club_members_club_id_fkey` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `club_members` ADD CONSTRAINT `club_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `club_invites` ADD CONSTRAINT `club_invites_club_id_fkey` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
