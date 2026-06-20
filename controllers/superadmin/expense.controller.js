import prisma from "../../prisma/client.js";
import multer from "multer";
import { uploadImage } from "../../config/s3.js";

// Multer for bill image (memory storage, 5MB max, images only)
const storage = multer.memoryStorage();
export const uploadBillImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
      return cb(new Error("Only image or PDF files are allowed"), false);
    }
    cb(null, true);
  },
}).single("billImage");

// ─── Stock-affecting categories (used for layer 2 logic) ─────────────────────
const isStockCategory = (category) =>
  ["Inventory", "Storage & Packaging"].includes(category);

// ─── Add Expense (new structured form) ───────────────────────────────────────
export const addExpense = async (req, res) => {
  const {
    outletId,
    expenseDate,
    categoryId,    // ExpenseCategory id
    category,      // category name (for backward compat / display)
    expenseNameId, // ExpenseName id
    description,   // expense name text (for backward compat)
    quantity,
    unit,
    unitPrice,
    amount,        // if manually provided instead of qty*unitPrice
    method,
    paidTo,
    vendorName,
    linkedInventoryItemId,
  } = req.body;

  if (!outletId || !expenseDate || !method) {
    return res.status(400).json({ message: "outletId, expenseDate, method are required" });
  }

  // Upload bill image to S3 if attached
  let billUrl = req.body.billUrl || null;
  if (req.file) {
    try {
      billUrl = await uploadImage(req.file.buffer, `bill-${Date.now()}-${req.file.originalname}`, req.file.mimetype);
    } catch (uploadErr) {
      console.error("Bill image upload failed:", uploadErr);
      // Non-fatal: continue without bill image
    }
  }

  const validMethods = ["UPI", "CARD", "CASH", "WALLET"];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: `Invalid payment method` });
  }

  try {
    // Resolve category details if categoryId provided
    let expenseCategory = null;
    let resolvedCategoryName = category || "Uncategorized";
    let resolvedDescription = description || "";
    let resolvedInventoryItemId = linkedInventoryItemId ? parseInt(linkedInventoryItemId) : null;

    if (categoryId) {
      expenseCategory = await prisma.expenseCategory.findUnique({ where: { id: parseInt(categoryId) } });
      if (expenseCategory) resolvedCategoryName = expenseCategory.name;
    }

    if (expenseNameId) {
      const expenseName = await prisma.expenseName.findUnique({
        where: { id: parseInt(expenseNameId) },
        include: { inventoryItem: true },
      });
      if (expenseName) {
        resolvedDescription = expenseName.name;
        if (expenseName.linkedInventoryItemId) {
          resolvedInventoryItemId = expenseName.linkedInventoryItemId;
        }
      }
    }

    // Calculate total amount
    const qty = quantity ? parseFloat(quantity) : null;
    const price = unitPrice ? parseFloat(unitPrice) : null;
    const totalAmount = amount
      ? parseFloat(amount)
      : qty && price
      ? qty * price
      : 0;

    if (totalAmount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const parsedDate = new Date(expenseDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid expenseDate" });
    }

    // Check if stock-affecting: either from category master or known stock categories
    const stockAffecting =
      (expenseCategory && expenseCategory.isStockAffecting) ||
      isStockCategory(resolvedCategoryName);

    if (stockAffecting) {
      if (!qty || qty <= 0) {
        return res.status(400).json({ message: "Quantity is required for stock-affecting categories" });
      }
      if (!resolvedInventoryItemId) {
        return res.status(400).json({ message: "Linked inventory item is required for stock-affecting categories" });
      }
    }

    // Save expense + (conditionally) update inventory in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          outletId: parseInt(outletId),
          description: resolvedDescription || "Expense",
          category: resolvedCategoryName,
          amount: totalAmount,
          method,
          paidTo: paidTo || vendorName || "N/A",
          expenseDate: parsedDate,
          quantity: qty,
          unit: unit || null,
          unitPrice: price,
          vendorName: vendorName || null,
          billUrl: billUrl || null,
          expenseNameId: expenseNameId ? parseInt(expenseNameId) : null,
          linkedInventoryItemId: resolvedInventoryItemId,
        },
      });

      // LAYER 2: stock inward
      if (stockAffecting && resolvedInventoryItemId && qty > 0) {
        const invItem = await tx.inventoryItem.findUnique({ where: { id: resolvedInventoryItemId } });
        if (!invItem) throw new Error("Linked inventory item not found");

        await tx.inventoryItem.update({
          where: { id: resolvedInventoryItemId },
          data: {
            currentStock: { increment: qty },
            // Update cost per unit with latest purchase price
            ...(price && price > 0 ? { costPerUnit: price } : {}),
          },
        });

        await tx.inventoryItemHistory.create({
          data: {
            inventoryItemId: resolvedInventoryItemId,
            outletId: parseInt(outletId),
            movementType: "INWARD",
            quantity: qty,
            unit: unit || invItem.stockUnit,
            source: "EXPENDITURE_ENTRY",
            referenceId: `EXP-${expense.id}`,
            remarks: `Purchase via expense entry - ${resolvedDescription}`,
          },
        });
      }

      return expense;
    });

    return res.status(201).json({ message: "Expense added successfully", expense: result });
  } catch (err) {
    console.error("Error adding expense:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ─── Edit Expense ─────────────────────────────────────────────────────────────
export const updateExpense = async (req, res) => {
  const { id } = req.params;
  const {
    expenseDate,
    categoryId,
    category,
    expenseNameId,
    description,
    quantity,
    unit,
    unitPrice,
    amount,
    method,
    paidTo,
    vendorName,
    linkedInventoryItemId,
  } = req.body;

  if (!expenseDate || !method) {
    return res.status(400).json({ message: "expenseDate and method are required" });
  }

  const validMethods = ["UPI", "CARD", "CASH", "WALLET"];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ message: "Invalid payment method" });
  }

  try {
    const existingExpense = await prisma.expense.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Resolve category and name details
    let expenseCategory = null;
    let resolvedCategoryName = category || existingExpense.category;
    let resolvedDescription = description || existingExpense.description;
    let resolvedInventoryItemId = linkedInventoryItemId !== undefined ? (linkedInventoryItemId ? parseInt(linkedInventoryItemId) : null) : existingExpense.linkedInventoryItemId;

    if (categoryId) {
      expenseCategory = await prisma.expenseCategory.findUnique({ where: { id: parseInt(categoryId) } });
      if (expenseCategory) resolvedCategoryName = expenseCategory.name;
    }

    if (expenseNameId) {
      const expenseName = await prisma.expenseName.findUnique({
        where: { id: parseInt(expenseNameId) },
        include: { inventoryItem: true },
      });
      if (expenseName) {
        resolvedDescription = expenseName.name;
        if (expenseName.linkedInventoryItemId) {
          resolvedInventoryItemId = expenseName.linkedInventoryItemId;
        }
      }
    }

    // Calculate total amount
    const qty = quantity !== undefined ? (quantity ? parseFloat(quantity) : null) : existingExpense.quantity;
    const price = unitPrice !== undefined ? (unitPrice ? parseFloat(unitPrice) : null) : existingExpense.unitPrice;
    const totalAmount = amount
      ? parseFloat(amount)
      : qty && price
      ? qty * price
      : existingExpense.amount;

    if (totalAmount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const parsedDate = new Date(expenseDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid expenseDate" });
    }

    const stockAffecting =
      (expenseCategory && expenseCategory.isStockAffecting) ||
      isStockCategory(resolvedCategoryName);

    if (stockAffecting && (!qty || qty <= 0 || !resolvedInventoryItemId)) {
      return res.status(400).json({ message: "Quantity and linked inventory item required for stock-affecting categories" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. REVERSE old inventory addition if applicable
      const oldStockAffecting = isStockCategory(existingExpense.category) || (existingExpense.linkedInventoryItemId && existingExpense.quantity > 0);
      if (oldStockAffecting && existingExpense.linkedInventoryItemId && existingExpense.quantity > 0) {
        await tx.inventoryItem.update({
          where: { id: existingExpense.linkedInventoryItemId },
          data: { currentStock: { decrement: existingExpense.quantity } },
        });

        await tx.inventoryItemHistory.deleteMany({
          where: { referenceId: `EXP-${existingExpense.id}` },
        });
      }

      // 2. UPDATE the Expense
      const updatedExpense = await tx.expense.update({
        where: { id: existingExpense.id },
        data: {
          description: resolvedDescription,
          category: resolvedCategoryName,
          amount: totalAmount,
          method,
          paidTo: paidTo !== undefined ? paidTo : existingExpense.paidTo,
          expenseDate: parsedDate,
          quantity: qty,
          unit: unit !== undefined ? unit : existingExpense.unit,
          unitPrice: price,
          vendorName: vendorName !== undefined ? vendorName : existingExpense.vendorName,
          expenseNameId: expenseNameId !== undefined ? (expenseNameId ? parseInt(expenseNameId) : null) : existingExpense.expenseNameId,
          linkedInventoryItemId: resolvedInventoryItemId,
        },
      });

      // 3. APPLY new inventory addition if applicable
      if (stockAffecting && resolvedInventoryItemId && qty > 0) {
        const invItem = await tx.inventoryItem.findUnique({ where: { id: resolvedInventoryItemId } });
        if (!invItem) throw new Error("Linked inventory item not found");

        await tx.inventoryItem.update({
          where: { id: resolvedInventoryItemId },
          data: {
            currentStock: { increment: qty },
            ...(price && price > 0 ? { costPerUnit: price } : {}),
          },
        });

        await tx.inventoryItemHistory.create({
          data: {
            inventoryItemId: resolvedInventoryItemId,
            outletId: updatedExpense.outletId,
            movementType: "INWARD",
            quantity: qty,
            unit: unit || invItem.stockUnit,
            source: "EXPENDITURE_ENTRY",
            referenceId: `EXP-${updatedExpense.id}`,
            remarks: `Edited purchase via expense entry - ${resolvedDescription}`,
          },
        });
      }

      return updatedExpense;
    });

    return res.status(200).json({ message: "Expense updated successfully", expense: result });
  } catch (err) {
    console.error("Error updating expense:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};

// ─── Delete Expense ───────────────────────────────────────────────────────────
export const deleteExpense = async (req, res) => {
  const { id } = req.params;

  try {
    const existingExpense = await prisma.expense.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. REVERSE inventory addition if applicable
      const isOldStockAffecting = isStockCategory(existingExpense.category) || (existingExpense.linkedInventoryItemId && existingExpense.quantity > 0);
      if (isOldStockAffecting && existingExpense.linkedInventoryItemId && existingExpense.quantity > 0) {
        await tx.inventoryItem.update({
          where: { id: existingExpense.linkedInventoryItemId },
          data: { currentStock: { decrement: existingExpense.quantity } },
        });

        await tx.inventoryItemHistory.deleteMany({
          where: { referenceId: `EXP-${existingExpense.id}` },
        });
      }

      // 2. DELETE the Expense
      await tx.expense.delete({
        where: { id: existingExpense.id },
      });
    });

    return res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    return res.status(500).json({ message: err.message || "Internal server error" });
  }
};


// ─── Get Expenses (last 2 weeks) ──────────────────────────────────────────────
export const getExpenses = async (req, res) => {
  const { outletId } = req.params;

  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const expenses = await prisma.expense.findMany({
      where: {
        outletId: parseInt(outletId),
        expenseDate: { gte: twoWeeksAgo, lte: new Date() },
      },
      orderBy: { expenseDate: "desc" },
    });

    return res.status(200).json({ message: "Expenses fetched", expenses });
  } catch (err) {
    console.error("Error fetching expenses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Get Expenses By Date Range ───────────────────────────────────────────────
export const getExpenseByDate = async (req, res) => {
  const { outletId, from, to } = req.body;

  if (!outletId || !from || !to) {
    return res.status(400).json({ message: "Provide outletId, from, to" });
  }

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        outletId: parseInt(outletId),
        expenseDate: { gte: new Date(from), lte: new Date(to) },
      },
      orderBy: { expenseDate: "desc" },
    });

    return res.status(200).json({ message: "Expenses fetched", count: expenses.length, expenses });
  } catch (err) {
    console.error("Error fetching expenses:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Expense Category Master ──────────────────────────────────────────────────
export const getExpenseCategories = async (req, res) => {
  const outletId = parseInt(req.params.outletId);
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { outletId },
      orderBy: { name: "asc" },
      include: { expenseNames: { select: { id: true, name: true, linkedInventoryItemId: true } } },
    });
    return res.status(200).json({ categories });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createExpenseCategory = async (req, res) => {
  const { outletId, name, isStockAffecting } = req.body;
  if (!outletId || !name) return res.status(400).json({ message: "outletId and name are required" });

  try {
    const existing = await prisma.expenseCategory.findFirst({
      where: { outletId: parseInt(outletId), name: name.trim() },
    });
    if (existing) return res.status(400).json({ message: "Category already exists" });

    const category = await prisma.expenseCategory.create({
      data: { outletId: parseInt(outletId), name: name.trim(), isStockAffecting: !!isStockAffecting },
    });
    return res.status(201).json({ message: "Category created", category });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteExpenseCategory = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.expenseCategory.delete({ where: { id } });
    return res.status(200).json({ message: "Category deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Expense Name Master ──────────────────────────────────────────────────────
export const getExpenseNames = async (req, res) => {
  const outletId = parseInt(req.params.outletId);
  const { categoryId } = req.query;

  try {
    const names = await prisma.expenseName.findMany({
      where: {
        outletId,
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        inventoryItem: { select: { id: true, itemName: true, stockUnit: true } },
        category: { select: { id: true, name: true, isStockAffecting: true } },
      },
    });
    return res.status(200).json({ names });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createExpenseName = async (req, res) => {
  const { outletId, categoryId, name, linkedInventoryItemId } = req.body;
  if (!outletId || !categoryId || !name) {
    return res.status(400).json({ message: "outletId, categoryId, and name are required" });
  }

  try {
    const expName = await prisma.expenseName.create({
      data: {
        outletId: parseInt(outletId),
        categoryId: parseInt(categoryId),
        name: name.trim(),
        linkedInventoryItemId: linkedInventoryItemId ? parseInt(linkedInventoryItemId) : null,
      },
    });
    return res.status(201).json({ message: "Expense name created", expName });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Expense name already exists in this category" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteExpenseName = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.expenseName.delete({ where: { id } });
    return res.status(200).json({ message: "Expense name deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Vendor Master ────────────────────────────────────────────────────────────
export const getVendors = async (req, res) => {
  const outletId = parseInt(req.params.outletId);
  try {
    const vendors = await prisma.vendor.findMany({
      where: { outletId },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ vendors });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createVendor = async (req, res) => {
  const { outletId, name } = req.body;
  if (!outletId || !name) return res.status(400).json({ message: "outletId and name are required" });

  try {
    const vendor = await prisma.vendor.create({
      data: { outletId: parseInt(outletId), name: name.trim() },
    });
    return res.status(201).json({ message: "Vendor created", vendor });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "Vendor already exists" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteVendor = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.vendor.delete({ where: { id } });
    return res.status(200).json({ message: "Vendor deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};