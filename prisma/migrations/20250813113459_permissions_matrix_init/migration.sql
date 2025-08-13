/*
  Warnings:

  - You are about to drop the `ApprovalOwner` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ApprovalStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectAllowedTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectDocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectDocumentFile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ApprovalOwner";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ApprovalStep";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DocumentTemplate";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProjectAllowedTemplate";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProjectDocument";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProjectDocumentFile";
PRAGMA foreign_keys=on;
