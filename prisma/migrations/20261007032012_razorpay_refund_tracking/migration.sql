-- AlterTable
ALTER TABLE `payment` ADD COLUMN `refundedAmount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `PaymentRefund` (
    `id` VARCHAR(191) NOT NULL,
    `razorpayRefundId` VARCHAR(255) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentRefund_razorpayRefundId_key`(`razorpayRefundId`),
    INDEX `PaymentRefund_paymentId_status_idx`(`paymentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaymentRefund` ADD CONSTRAINT `PaymentRefund_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
