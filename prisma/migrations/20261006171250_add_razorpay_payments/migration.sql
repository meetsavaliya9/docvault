-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `planKey` ENUM('FREE', 'PLUS', 'PRO') NULL,
    ADD COLUMN `startDate` DATETIME(3) NULL,
    MODIFY `stripeSubscriptionId` VARCHAR(255) NULL,
    MODIFY `stripePriceId` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `razorpayOrderId` VARCHAR(255) NOT NULL,
    `razorpayPaymentId` VARCHAR(255) NULL,
    `razorpaySignature` CHAR(64) NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `plan` ENUM('FREE', 'PLUS', 'PRO') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_razorpayOrderId_key`(`razorpayOrderId`),
    UNIQUE INDEX `Payment_razorpayPaymentId_key`(`razorpayPaymentId`),
    INDEX `Payment_userId_status_idx`(`userId`, `status`),
    INDEX `Payment_subscriptionId_idx`(`subscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Subscription_userId_planKey_endDate_idx` ON `Subscription`(`userId`, `planKey`, `endDate`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
