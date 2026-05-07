-- CreateEnum
CREATE TYPE "InventoryItemCategory" AS ENUM ('Ingredient', 'Packaging', 'ServingItem', 'Consumable', 'Cleaning', 'Other');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INWARD', 'OUTWARD');

-- CreateEnum
CREATE TYPE "MovementSource" AS ENUM ('EXPENDITURE_ENTRY', 'MANUAL_ADD', 'APP_SALE', 'POS_SALE', 'MANUAL_DEDUCTION', 'CANCELLATION_REVERSAL');

-- CreateEnum
CREATE TYPE "RecipeItemType" AS ENUM ('RAW_MATERIAL', 'SERVING_ITEM', 'PACKAGING_ITEM');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "billUrl" TEXT,
ADD COLUMN     "expenseNameId" INTEGER,
ADD COLUMN     "linkedInventoryItemId" INTEGER,
ADD COLUMN     "quantity" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unitPrice" DOUBLE PRECISION,
ADD COLUMN     "vendorName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "recipeConfigured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemCategory" "InventoryItemCategory" NOT NULL,
    "stockUnit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItemHistory" (
    "id" SERIAL NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "outletId" INTEGER NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" "MovementSource" NOT NULL,
    "referenceId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "itemType" "RecipeItemType" NOT NULL,
    "quantityPerServing" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isStockAffecting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseName" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "linkedInventoryItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "outletId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_outletId_itemName_key" ON "InventoryItem"("outletId", "itemName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipe_productId_inventoryItemId_key" ON "ProductRecipe"("productId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_outletId_name_key" ON "ExpenseCategory"("outletId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseName_outletId_categoryId_name_key" ON "ExpenseName"("outletId", "categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_outletId_name_key" ON "Vendor"("outletId", "name");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemHistory" ADD CONSTRAINT "InventoryItemHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemHistory" ADD CONSTRAINT "InventoryItemHistory_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseName" ADD CONSTRAINT "ExpenseName_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseName" ADD CONSTRAINT "ExpenseName_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseName" ADD CONSTRAINT "ExpenseName_linkedInventoryItemId_fkey" FOREIGN KEY ("linkedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_linkedInventoryItemId_fkey" FOREIGN KEY ("linkedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
