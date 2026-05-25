ALTER TABLE `OptimizedVersion`
  ADD COLUMN `snapshotJson` JSON NULL,
  ADD COLUMN `restoredFromVersionId` VARCHAR(191) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `OptimizedVersion_resumeId_createdAt_idx`
  ON `OptimizedVersion`(`resumeId`, `createdAt`);

CREATE INDEX `OptimizedVersion_deletedAt_idx`
  ON `OptimizedVersion`(`deletedAt`);

CREATE INDEX `OptimizedVersion_restoredFromVersionId_idx`
  ON `OptimizedVersion`(`restoredFromVersionId`);
