ALTER TABLE `User`
ADD COLUMN `stripeCustomerId` VARCHAR(255) NULL;

CREATE UNIQUE INDEX `User_stripeCustomerId_key`
ON `User`(`stripeCustomerId`);

CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `stripeSubscriptionId` VARCHAR(255) NOT NULL,
    `stripePriceId` VARCHAR(255) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_stripeSubscriptionId_key`(`stripeSubscriptionId`),
    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Subscription`
ADD CONSTRAINT `Subscription_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
