-- AlterTable
ALTER TABLE `document` ADD COLUMN `cloudinaryPublicId` VARCHAR(255) NULL,
    ADD COLUMN `cloudinaryResourceType` VARCHAR(20) NULL,
    ADD COLUMN `cloudinaryVersion` INTEGER NULL;
