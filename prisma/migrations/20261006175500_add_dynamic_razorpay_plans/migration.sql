ALTER TABLE `SubscriptionPlanPricing`
ADD COLUMN `razorpayPlanId` VARCHAR(255) NULL;

CREATE TABLE `RazorpayPlan` (
    `providerPlanId` VARCHAR(255) NOT NULL,
    `planKey` VARCHAR(20) NOT NULL,
    `amount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`providerPlanId`),
    INDEX `RazorpayPlan_planKey_idx`(`planKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
