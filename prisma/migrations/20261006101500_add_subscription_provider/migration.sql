ALTER TABLE `Subscription`
ADD COLUMN `provider` VARCHAR(20) NOT NULL DEFAULT 'stripe';
