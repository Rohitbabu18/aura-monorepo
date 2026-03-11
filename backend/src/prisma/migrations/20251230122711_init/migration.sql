-- CreateEnum
CREATE TYPE "HospitalRole" AS ENUM ('HOSPITAL', 'CLINIC');

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "hospitalId" TEXT,
    "complete" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "pincode" INTEGER,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "role" "HospitalRole" NOT NULL DEFAULT 'HOSPITAL',
    "facilityType" TEXT,
    "ownershipType" TEXT,
    "numberOfBeds" INTEGER,
    "numberOfIcuBeds" INTEGER,
    "numberOfVentilators" INTEGER,
    "emergencyAvailable" BOOLEAN,
    "specialtiesOffered" TEXT[],
    "accreditationDetails" TEXT,
    "registrationNumber" TEXT,
    "yearEstablished" INTEGER,
    "licenseNumber" TEXT,
    "servicesOffered" TEXT[],
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingData" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "open24Hours" BOOLEAN,
    "visitingHours" TEXT,
    "openTime" TEXT,
    "closeTime" TEXT,
    "weekDays" TEXT[],

    CONSTRAINT "OperatingData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Address_userId_key" ON "Address"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Address_hospitalId_key" ON "Address"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_email_key" ON "Hospital"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingData_hospitalId_key" ON "OperatingData"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_hospitalId_key" ON "Location"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_userId_key" ON "Location"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingData" ADD CONSTRAINT "OperatingData_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
