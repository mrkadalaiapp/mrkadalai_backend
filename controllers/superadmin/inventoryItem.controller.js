import prisma from "../../prisma/client.js";

// ─── InventoryItem CRUD ───────────────────────────────────────────────────────

export const getInventoryItems = async (req, res) => {
  const outletId = parseInt(req.params.outletId);
  if (!outletId) return res.status(400).json({ message: "Provide outletId" });

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { outletId, status: "ACTIVE" },
      orderBy: { itemName: "asc" },
    });

    const itemsWithStatus = items.map((item) => ({
      ...item,
      stockStatus:
        item.currentStock === 0
          ? "OUT_OF_STOCK"
          : item.currentStock <= item.reorderThreshold
          ? "LOW_STOCK"
          : "HEALTHY",
    }));

    return res.status(200).json({ items: itemsWithStatus });
  } catch (err) {
    console.error("Error fetching inventory items:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createInventoryItem = async (req, res) => {
  const { outletId, itemName, itemCategory, stockUnit, reorderThreshold, costPerUnit } = req.body;

  if (!outletId || !itemName || !itemCategory || !stockUnit) {
    return res.status(400).json({ message: "outletId, itemName, itemCategory, stockUnit are required" });
  }

  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { outletId: parseInt(outletId), itemName: itemName.trim() },
    });
    if (existing) {
      return res.status(400).json({ message: `Item "${itemName}" already exists in inventory` });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        outletId: parseInt(outletId),
        itemName: itemName.trim(),
        itemCategory,
        stockUnit: stockUnit.trim(),
        reorderThreshold: parseFloat(reorderThreshold) || 0,
        costPerUnit: parseFloat(costPerUnit) || 0,
      },
    });

    return res.status(201).json({ message: "Inventory item created", item });
  } catch (err) {
    console.error("Error creating inventory item:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInventoryItem = async (req, res) => {
  const id = parseInt(req.params.id);
  const { itemName, itemCategory, stockUnit, reorderThreshold, costPerUnit, status } = req.body;

  try {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(itemName && { itemName: itemName.trim() }),
        ...(itemCategory && { itemCategory }),
        ...(stockUnit && { stockUnit: stockUnit.trim() }),
        ...(reorderThreshold !== undefined && { reorderThreshold: parseFloat(reorderThreshold) }),
        ...(costPerUnit !== undefined && { costPerUnit: parseFloat(costPerUnit) }),
        ...(status && { status }),
      },
    });

    return res.status(200).json({ message: "Inventory item updated", item });
  } catch (err) {
    console.error("Error updating inventory item:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteInventoryItem = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    // Soft delete: mark inactive
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    return res.status(200).json({ message: "Inventory item deactivated", item });
  } catch (err) {
    console.error("Error deleting inventory item:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Manual Stock Adjustments ─────────────────────────────────────────────────

export const manualAddStock = async (req, res) => {
  const { inventoryItemId, outletId, quantity, remarks } = req.body;

  if (!inventoryItemId || !outletId || !quantity || parseFloat(quantity) <= 0) {
    return res.status(400).json({ message: "inventoryItemId, outletId, quantity (> 0) are required" });
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: parseInt(inventoryItemId), outletId: parseInt(outletId) },
    });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: parseInt(inventoryItemId) },
        data: { currentStock: { increment: parseFloat(quantity) } },
      }),
      prisma.inventoryItemHistory.create({
        data: {
          inventoryItemId: parseInt(inventoryItemId),
          outletId: parseInt(outletId),
          movementType: "INWARD",
          quantity: parseFloat(quantity),
          unit: item.stockUnit,
          source: "MANUAL_ADD",
          remarks: remarks || null,
        },
      }),
    ]);

    return res.status(200).json({ message: "Stock added", currentStock: updated.currentStock });
  } catch (err) {
    console.error("Error adding stock:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const manualDeductStock = async (req, res) => {
  const { inventoryItemId, outletId, quantity, reason } = req.body;

  if (!inventoryItemId || !outletId || !quantity || parseFloat(quantity) <= 0) {
    return res.status(400).json({ message: "inventoryItemId, outletId, quantity (> 0) are required" });
  }
  if (!reason) {
    return res.status(400).json({ message: "reason is required for manual deduction" });
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: parseInt(inventoryItemId), outletId: parseInt(outletId) },
    });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });

    const deductQty = parseFloat(quantity);
    if (item.currentStock < deductQty) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${item.currentStock} ${item.stockUnit}` });
    }

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: parseInt(inventoryItemId) },
        data: { currentStock: { decrement: deductQty } },
      }),
      prisma.inventoryItemHistory.create({
        data: {
          inventoryItemId: parseInt(inventoryItemId),
          outletId: parseInt(outletId),
          movementType: "OUTWARD",
          quantity: deductQty,
          unit: item.stockUnit,
          source: "MANUAL_DEDUCTION",
          remarks: reason,
        },
      }),
    ]);

    return res.status(200).json({ message: "Stock deducted", currentStock: updated.currentStock });
  } catch (err) {
    console.error("Error deducting stock:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Stock History ────────────────────────────────────────────────────────────

export const getInventoryItemHistory = async (req, res) => {
  const { outletId, startDate, endDate, inventoryItemId, source } = req.body;

  if (!outletId || !startDate || !endDate) {
    return res.status(400).json({ message: "outletId, startDate, endDate are required" });
  }

  try {
    const where = {
      outletId: parseInt(outletId),
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      },
      ...(inventoryItemId && { inventoryItemId: parseInt(inventoryItemId) }),
      ...(source && { source }),
    };

    const history = await prisma.inventoryItemHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        inventoryItem: {
          select: { id: true, itemName: true, stockUnit: true, itemCategory: true },
        },
      },
    });

    return res.status(200).json({ message: "History fetched", history });
  } catch (err) {
    console.error("Error fetching inventory history:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
