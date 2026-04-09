-- AlterTable
ALTER TABLE `wod_exercises` ADD COLUMN `exercise_dict_id_female` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `wod_exercises` ADD CONSTRAINT `wod_exercises_exercise_dict_id_female_fkey` FOREIGN KEY (`exercise_dict_id_female`) REFERENCES `exercises_dict`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
