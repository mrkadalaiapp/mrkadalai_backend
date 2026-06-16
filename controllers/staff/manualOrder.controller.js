import prisma from "../../prisma/client.js";

// ─── Shared: check inventory availability via recipe ──────────────────────────
export const checkRecipeAvailability = async (items, outletId, tx = prisma) => {
  const shortages = [];
  const aggregatedRequirements = {};

  for (const item of items) {
    const recipe = await tx.productRecipe.findMany({
      where: { productId: item.productId },
      include: { inventoryItem: true },
    });

    if (recipe.length === 0) {
      shortages.push({ productId: item.productId, message: `Recipe not configured for product #${item.productId}` });
      continue;
    }

    for (const row of recipe) {
      const requiredQty = row.quantityPerServing * item.quantity;
      const itemId = row.inventoryItemId;

      if (!aggregatedRequirements[itemId]) {
        aggregatedRequirements[itemId] = {
          required: 0,
          available: row.inventoryItem.currentStock,
          itemName: row.inventoryItem.itemName,
          unit: row.unit,
        };
      }
      aggregatedRequirements[itemId].required += requiredQty;
    }
  }

  // Verification pass against the aggregated dictionary
  for (const [itemId, data] of Object.entries(aggregatedRequirements)) {
    if (data.available < data.required) {
      shortages.push({
        item: data.itemName,
        required: `${data.required} ${data.unit}`,
        available: `${data.available} ${data.unit}`,
      });
    }
  }

  return shortages;
};

export const addManualOrder = async (req, res) => {
  const { outletId, totalAmount, paymentMethod, items, status } = req.body;

  if (!outletId || !totalAmount || !paymentMethod || !items || items.length === 0) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // ── Recipe-based availability check ──
    const shortages = await checkRecipeAvailability(items, outletId);
    if (shortages.length > 0) {
      return res.status(400).json({
        message: "Insufficient inventory for order",
        shortages,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parsedOutletId = parseInt(outletId, 10);
      const parsedTotalAmount = parseFloat(totalAmount);

      const createdOrder = await tx.order.create({
        data: {
          outletId: parsedOutletId,
          totalAmount: parsedTotalAmount,
          paymentMethod,
          status: "DELIVERED",
          type: "MANUAL",
          customerId: null,
          deliveryDate: today,
          isPreOrder: false,
          deliveredAt: new Date(),
          items: {
            create: items.map((item) => ({
              productId: parseInt(item.productId, 10),
              quantity: parseInt(item.quantity, 10),
              unitPrice: parseFloat(item.unitPrice),
              status: "DELIVERED",
            })),
          },
        },
        include: { items: true },
      });

      // ── Recipe-based inventory deduction ──
      for (const item of items) {
        const recipe = await tx.productRecipe.findMany({
          where: { productId: item.productId },
          include: { inventoryItem: true },
        });

        for (const row of recipe) {
          const deductQty = row.quantityPerServing * item.quantity;
          await tx.inventoryItem.update({
            where: { id: row.inventoryItemId },
            data: { currentStock: { decrement: deductQty } },
          });
          await tx.inventoryItemHistory.create({
            data: {
              inventoryItemId: row.inventoryItemId,
              outletId: parseInt(outletId),
              movementType: "OUTWARD",
              quantity: deductQty,
              unit: row.unit,
              source: "POS_SALE",
              referenceId: `ORD-${createdOrder.id}`,
              remarks: `Manual order: ${item.quantity}x product #${item.productId}`,
            },
          });
        }
      }

      return createdOrder;
    });

    res.status(201).json({ message: "Manual order created", order });
  } catch (error) {
    console.error("Error creating manual order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getProducts = async (req, res) => {
  const outletId = parseInt(req.params.outletId);

  if (!outletId) {
    return res.status(400).json({ message: "Provide a valid outletId" });
  }

  try {
    // Get products that have recipes configured with enough stock
    const products = await prisma.product.findMany({
      where: { outletId },
      include: {
        recipes: {
          include: {
            inventoryItem: { select: { id: true, currentStock: true, reorderThreshold: true, stockUnit: true } },
          },
        },
      },
    });

    const availableProducts = products
      .filter((p) => p.recipeConfigured && p.recipes.length > 0)
      .map((p) => {
        let maxQuantity = Infinity;
        p.recipes.forEach((r) => {
          if (r.quantityPerServing > 0) {
            const possible = Math.floor(r.inventoryItem.currentStock / r.quantityPerServing);
            if (possible < maxQuantity) maxQuantity = possible;
          }
        });
        
        if (maxQuantity === Infinity || maxQuantity < 0) maxQuantity = 0;

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          imageUrl: p.imageUrl,
          category: p.category,
          inStock: maxQuantity > 0,
          quantityAvailable: maxQuantity,
          recipeConfigured: p.recipeConfigured,
          recipes: p.recipes,
        };
      });

    return res.status(200).json({ products: availableProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
};
