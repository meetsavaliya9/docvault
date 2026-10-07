CREATE TABLE `SubscriptionPlanPricing` (
    `planKey` VARCHAR(20) NOT NULL,
    `amount` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`planKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
