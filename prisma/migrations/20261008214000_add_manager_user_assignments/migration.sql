CREATE TABLE `ManagerAssignment` (
  `id` VARCHAR(36) NOT NULL,
  `managerId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ManagerAssignment_userId_key` (`userId`),
  INDEX `ManagerAssignment_managerId_idx` (`managerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ManagerAssignment_managerId_fkey`
    FOREIGN KEY (`managerId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ManagerAssignment_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
