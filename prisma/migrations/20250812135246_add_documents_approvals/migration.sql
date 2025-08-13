-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "ownerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    CONSTRAINT "ApprovalStep_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ProjectDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
