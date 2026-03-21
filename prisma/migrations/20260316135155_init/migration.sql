-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `avatar` VARCHAR(500) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `verification_tokens_token_key`(`token`),
    INDEX `verification_tokens_token_idx`(`token`),
    INDEX `verification_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_token_idx`(`token`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercises_dict` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_global` BOOLEAN NOT NULL DEFAULT false,
    `user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exercises_dict_name_idx`(`name`),
    INDEX `exercises_dict_user_id_idx`(`user_id`),
    UNIQUE INDEX `exercises_dict_name_user_id_key`(`name`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workouts` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `date` VARCHAR(10) NOT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workouts_user_id_date_idx`(`user_id`, `date`),
    INDEX `workouts_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_blocks` (
    `id` VARCHAR(36) NOT NULL,
    `workout_id` VARCHAR(36) NOT NULL,
    `exercise_dict_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skill_blocks_workout_id_idx`(`workout_id`),
    INDEX `skill_blocks_exercise_dict_id_idx`(`exercise_dict_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_sets` (
    `id` VARCHAR(36) NOT NULL,
    `skill_block_id` VARCHAR(36) NOT NULL,
    `set_number` INTEGER NOT NULL,
    `reps` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,

    INDEX `skill_sets_skill_block_id_idx`(`skill_block_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wod_blocks` (
    `id` VARCHAR(36) NOT NULL,
    `workout_id` VARCHAR(36) NOT NULL,
    `wod_type` ENUM('FOR_TIME', 'AMRAP', 'EMOM', 'TABATA') NOT NULL,
    `level` ENUM('RX', 'SCALED') NOT NULL,
    `time_cap_seconds` INTEGER NULL,
    `is_ladder` BOOLEAN NOT NULL DEFAULT false,
    `result_type` ENUM('TIME', 'REPS', 'WEIGHT') NOT NULL,
    `result_display` VARCHAR(50) NOT NULL,
    `result_seconds` INTEGER NULL,
    `result_total_reps` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wod_blocks_workout_id_idx`(`workout_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wod_exercises` (
    `id` VARCHAR(36) NOT NULL,
    `wod_block_id` VARCHAR(36) NOT NULL,
    `exercise_dict_id` VARCHAR(36) NOT NULL,
    `reps` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NULL,
    `order_index` INTEGER NOT NULL,

    INDEX `wod_exercises_wod_block_id_idx`(`wod_block_id`),
    INDEX `wod_exercises_exercise_dict_id_idx`(`exercise_dict_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercises_dict` ADD CONSTRAINT `exercises_dict_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workouts` ADD CONSTRAINT `workouts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_blocks` ADD CONSTRAINT `skill_blocks_workout_id_fkey` FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_blocks` ADD CONSTRAINT `skill_blocks_exercise_dict_id_fkey` FOREIGN KEY (`exercise_dict_id`) REFERENCES `exercises_dict`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_sets` ADD CONSTRAINT `skill_sets_skill_block_id_fkey` FOREIGN KEY (`skill_block_id`) REFERENCES `skill_blocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wod_blocks` ADD CONSTRAINT `wod_blocks_workout_id_fkey` FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wod_exercises` ADD CONSTRAINT `wod_exercises_wod_block_id_fkey` FOREIGN KEY (`wod_block_id`) REFERENCES `wod_blocks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wod_exercises` ADD CONSTRAINT `wod_exercises_exercise_dict_id_fkey` FOREIGN KEY (`exercise_dict_id`) REFERENCES `exercises_dict`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
