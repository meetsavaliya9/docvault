ALTER TABLE `SubscriptionPlan`
  MODIFY `slug` VARCHAR(40) NOT NULL,
  ADD COLUMN `razorpayPlanId` VARCHAR(255) NULL,
  ADD UNIQUE INDEX `SubscriptionPlan_name_key` (`name`),
  ADD UNIQUE INDEX `SubscriptionPlan_razorpayPlanId_key` (`razorpayPlanId`);

ALTER TABLE `Subscription`
  MODIFY `planKey` VARCHAR(40) NULL;

ALTER TABLE `Payment`
  MODIFY `plan` VARCHAR(40) NOT NULL;

ALTER TABLE `SubscriptionPlanPricing`
  MODIFY `planKey` VARCHAR(40) NOT NULL;

ALTER TABLE `RazorpayPlan`
  MODIFY `planKey` VARCHAR(40) NOT NULL;
