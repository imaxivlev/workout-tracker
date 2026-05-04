-- AlterTable
ALTER TABLE `exercises_dict` ADD COLUMN `has_weight` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `measure_unit` VARCHAR(20) NOT NULL DEFAULT 'reps';
