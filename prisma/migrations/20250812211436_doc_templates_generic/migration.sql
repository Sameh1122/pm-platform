-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAllowedTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    CONSTRAINT "ProjectAllowedTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectAllowedTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "ownerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectDocument" ("content", "createdAt", "id", "ownerId", "projectId", "status", "type") SELECT "content", "createdAt", "id", "ownerId", "projectId", "status", "type" FROM "ProjectDocument";
DROP TABLE "ProjectDocument";
ALTER TABLE "new_ProjectDocument" RENAME TO "ProjectDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_name_key" ON "DocumentTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAllowedTemplate_projectId_templateId_key" ON "ProjectAllowedTemplate"("projectId", "templateId");
