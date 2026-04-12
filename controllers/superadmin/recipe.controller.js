import prisma from "../../prisma/client.js";

// ─── Recipe CRUD ──────────────────────────────────────────────────────────────

export const getProductRecipe = async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (!productId) return res.status(400).json({ message: "Provide productId" });

  try {
    const recipe = await prisma.productRecipe.findMany({
      where: { productId },
      include: {
        inventoryItem: {
          select: { id: true, itemName: true, stockUnit: true, costPerUnit: true, currentStock: true },
        },
      },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({ recipe });
  } catch (err) {
    console.error("Error fetching recipe:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const saveProductRecipe = async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { rows } = req.body; // Array of recipe row objects

  if (!productId) return res.status(400).json({ message: "Provide productId" });
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "At least one recipe row is required" });
  }

  // Validate all rows
  for (const row of rows) {
    if (!row.inventoryItemId || !row.quantityPerServing || parseFloat(row.quantityPerServing) <= 0 || !row.itemType) {
      return res.status(400).json({ message: "Each row needs inventoryItemId, quantityPerServing > 0, and itemType" });
    }
  }

  // Check for duplicate inventory items in the same recipe
  const itemIds = rows.map((r) => parseInt(r.inventoryItemId));
  if (new Set(itemIds).size !== itemIds.length) {
    return res.status(400).json({ message: "Duplicate inventory items in recipe are not allowed" });
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Fetch inventory items to get units and cost
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
    });
    const itemMap = Object.fromEntries(inventoryItems.map((i) => [i.id, i]));

    await prisma.$transaction(async (tx) => {
      // Delete all existing recipe rows for this product
      await tx.productRecipe.deleteMany({ where: { productId } });

      // Insert new rows
      for (const row of rows) {
        const invItem = itemMap[parseInt(row.inventoryItemId)];
        if (!invItem) throw new Error(`Inventory item ${row.inventoryItemId} not found`);

        await tx.productRecipe.create({
          data: {
            productId,
            inventoryItemId: parseInt(row.inventoryItemId),
            itemType: row.itemType,
            quantityPerServing: parseFloat(row.quantityPerServing),
            unit: invItem.stockUnit,
            costPerUnit: invItem.costPerUnit,
          },
        });
      }

      // Mark product as recipe configured
      await tx.product.update({
        where: { id: productId },
        data: { recipeConfigured: true },
      });
    });

    const savedRecipe = await prisma.productRecipe.findMany({
      where: { productId },
      include: {
        inventoryItem: {
          select: { id: true, itemName: true, stockUnit: true, costPerUnit: true },
        },
      },
    });

    return res.status(200).json({ message: "Recipe saved successfully", recipe: savedRecipe });
  } catch (err) {
    console.error("Error saving recipe:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

export const deleteRecipeRow = async (req, res) => {
  const recipeId = parseInt(req.params.recipeId);

  try {
    // Delete the row
    const deleted = await prisma.productRecipe.delete({ where: { id: recipeId } });

    // If this was the last recipe row, mark product as not configured
    const remaining = await prisma.productRecipe.count({ where: { productId: deleted.productId } });
    if (remaining === 0) {
      await prisma.product.update({
        where: { id: deleted.productId },
        data: { recipeConfigured: false },
      });
    }

    return res.status(200).json({ message: 'Recipe row deleted' });
  } catch (err) {
    console.error('Error deleting recipe row:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
