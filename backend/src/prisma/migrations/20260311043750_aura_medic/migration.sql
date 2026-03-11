/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "ambulanceAvailable" BOOLEAN,
ADD COLUMN     "totalStaff" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "registrationAuthority" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "specialization" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
