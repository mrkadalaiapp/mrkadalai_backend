import prisma from "../../prisma/client.js";

export const getStocks = async (req, res) => {
  const outletId = parseInt(req.params.outletId);
  if (!outletId) return res.status(400).json({ message: "Provide outletId" });

  try {
    const items = await prisma.inventoryItem.findMany({
      where: { outletId, status: "ACTIVE" },
      orderBy: { itemName: "asc" },
    });

    const stocks = items.map((item) => ({
      id: item.id,
      name: item.itemName,
      category: item.itemCategory,
      stockUnit: item.stockUnit,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      costPerUnit: item.costPerUnit,
      stockStatus:
        item.currentStock === 0
          ? "OUT_OF_STOCK"
          : item.currentStock <= item.reorderThreshold
          ? "LOW_STOCK"
          : "HEALTHY",
    }));

    return res.status(200).json({ stocks });
  } catch (err) {
    console.error("Error fetching stocks:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addStock = async (req, res) => {
  const { inventoryItemId, outletId, addedQuantity, remarks } = req.body;

  if (!inventoryItemId || !outletId || !addedQuantity) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: parseInt(inventoryItemId), outletId: parseInt(outletId) },
    });
    if (!item) return res.status(404).json({ message: "Inventory item not found" });

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: parseInt(inventoryItemId) },
        data: { currentStock: { increment: parseFloat(addedQuantity) } },
      }),
      prisma.inventoryItemHistory.create({
        data: {
          inventoryItemId: parseInt(inventoryItemId),
          outletId: parseInt(outletId),
          movementType: "INWARD",
          quantity: parseFloat(addedQuantity),
          unit: item.stockUnit,
          source: "MANUAL_ADD",
          remarks: remarks || null,
        },
      }),
    ]);

    return res.status(200).json({ message: "Stock updated", currentStock: updated.currentStock });
  } catch (err) {
    console.error("Error adding stock:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deductStock = async (req, res) => {
  const { inventoryItemId, outletId, quantity, reason } = req.body;

  if (!inventoryItemId || !outletId || !quantity || parseFloat(quantity) <= 0) {
    return res.status(400).json({ message: "Provide valid inventoryItemId, outletId, and quantity." });
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: parseInt(inventoryItemId), outletId: parseInt(outletId) },
    });
    if (!item) return res.status(404).json({ message: "Inventory item not found." });

    const deductQty = parseFloat(quantity);
    if (item.currentStock < deductQty) {
      return res.status(400).json({ message: "Insufficient stock available." });
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
          remarks: reason || "Manual deduction",
        },
      }),
    ]);

    res.status(200).json({ message: "Stock deducted", currentStock: updated.currentStock });
  } catch (err) {
    console.error("Error deducting stock:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const stockHistory = async (req, res) => {
  const { outletId, startDate, endDate, inventoryItemId, source } = req.body;

  if (!outletId || !startDate || !endDate) {
    return res.status(400).json({ message: "outletId, startDate, and endDate are required." });
  }

  try {
    const history = await prisma.inventoryItemHistory.findMany({
      where: {
        outletId: parseInt(outletId),
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
        ...(inventoryItemId ? (
          Array.isArray(inventoryItemId) 
            ? { inventoryItemId: { in: inventoryItemId.map(id => parseInt(id)) } } 
            : { inventoryItemId: parseInt(inventoryItemId) }
        ) : {}),
        ...(source ? (
          Array.isArray(source) 
            ? { source: { in: source } } 
            : { source }
        ) : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        inventoryItem: {
          select: { id: true, itemName: true, stockUnit: true, itemCategory: true },
        },
      },
    });

    res.status(200).json({ message: "Stock history fetched", history });
  } catch (error) {
    console.error("Error fetching stock history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
