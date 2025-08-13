-- CreateTable
CREATE TABLE "RoleAssignable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "managerRoleId" INTEGER NOT NULL,
    "targetRoleId" INTEGER NOT NULL,
    CONSTRAINT "RoleAssignable_managerRoleId_fkey" FOREIGN KEY ("managerRoleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleAssignable_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignable_managerRoleId_targetRoleId_key" ON "RoleAssignable"("managerRoleId", "targetRoleId");
