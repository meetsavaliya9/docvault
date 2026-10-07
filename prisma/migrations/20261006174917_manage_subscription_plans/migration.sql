-- AlterTable
ALTER TABLE `payment` ADD COLUMN `amountPaid` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `billingPeriod` VARCHAR(20) NOT NULL DEFAULT 'monthly',
    ADD COLUMN `planId` VARCHAR(40) NULL,
    ADD COLUMN `planName` VARCHAR(80) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `planId` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `SubscriptionPlan` (
    `id` VARCHAR(40) NOT NULL,
    `slug` ENUM('FREE', 'PLUS', 'PRO') NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `price` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `billingPeriod` VARCHAR(20) NOT NULL DEFAULT 'monthly',
    `description` VARCHAR(500) NOT NULL,
    `features` JSON NOT NULL,
    `documentLimit` INTEGER NULL,
    `storageLimitBytes` BIGINT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isRecommended` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubscriptionPlan_slug_key`(`slug`),
    INDEX `SubscriptionPlan_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_planId_idx` ON `Payment`(`planId`);

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
