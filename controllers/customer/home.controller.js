import prisma from "../../prisma/client.js";

export const getProductsAndStocks = async (req, res) => {
  try {
    const outletId = req.user.outletId;

    if (!outletId) {
      return res.status(400).json({ message: "Outlet ID not found in request." });
    }

    // Fetch products with their inventory and recipes
    const products = await prisma.product.findMany({
      where: { outletId },
      include: {
        inventory: true,
        recipes: {
          include: {
            inventoryItem: true
          }
        }
      },
    });

    // Calculate dynamic stock based on ingredients
    const productsWithSmartStock = products.map(product => {
      // If no recipe is configured, fallback to manual inventory quantity
      if (!product.recipeConfigured || !product.recipes || product.recipes.length === 0) {
        return product;
      }

      // Calculate how many servings can be made from each ingredient
      const potentialServings = product.recipes.map(recipe => {
        const ingredient = recipe.inventoryItem;
        if (!ingredient || ingredient.currentStock <= 0) return 0;
        
        // available = current_stock / qty_required_per_serving
        return Math.floor(ingredient.currentStock / recipe.quantityPerServing);
      });

      // The actual available quantity is limited by the scarcest ingredient
      const maxPossibleServings = Math.min(...potentialServings);

      // We combine manual stock (already made) + potential stock (can be made)
      const totalAvailable = (product.inventory?.quantity || 0) + maxPossibleServings;

      return {
        ...product,
        inventory: {
          ...product.inventory,
          quantity: totalAvailable
        }
      };
    });

    res.status(200).json({ products: productsWithSmartStock });
  } catch (error) {
    console.error("Error fetching products and stocks:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const getAvailableDatesAndSlotsForCustomer = async (req, res) => {
  const { outletId } = req.params;
  if (!outletId || isNaN(parseInt(outletId))) {
    return res.status(400).json({ message: "Valid outletId is required" });
  }

  try {
    const outletIdNum = parseInt(outletId);
    const today = new Date(); 
    const next30Days = new Date(today);
    next30Days.setDate(today.getDate() + 30);

    const nonAvailable = await prisma.outletAvailability.findMany({
      where: {
        outletId: outletIdNum,
        date: {
          gte: today,
          lte: next30Days,
        },
      },
    });

    const allSlots = [
      "SLOT_11_12",
      "SLOT_12_13",
      "SLOT_13_14",
      "SLOT_14_15",
      "SLOT_15_16",
      "SLOT_16_17",
    ];

    // Generate available dates
    const availableDates = [];
    for (let d = new Date(today); d <= next30Days; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const nonAvailEntry = nonAvailable.find((entry) => entry.date.toISOString().split("T")[0] === dateStr);
      const availableSlots = nonAvailEntry
        ? allSlots.filter((slot) => !nonAvailEntry.nonAvailableSlots.includes(slot))
        : [...allSlots];

      if (availableSlots.length > 0) {
        availableDates.push({
          date: dateStr,
          availableSlots,
        });
      }
    }

    res.status(200).json({ message: "Available dates and slots fetched", data: availableDates });
  } catch (error) {
    console.error("Error fetching available dates and slots:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getOutlets = async (req, res) => {
  try {
    const outlets = await prisma.outlet.findMany();
    res.status(200).json({ outlets });
  } catch (error) {
    console.error("Error fetching outlets:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};