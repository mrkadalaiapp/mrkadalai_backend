// controllers/superadmin/product.controller.js
import prisma from "../../prisma/client.js";
import cron from "node-cron";
import { uploadImage } from "../../config/s3.js"; // Adjust path
import multer from "multer";

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
}).single("image");

// cron.schedule("0 0 * * *", async () => {
//   try {
//     console.log("Running midnight stock reset...");
//     const inventories = await prisma.inventory.findMany({
//       include: {
//         product: true,
//       },
//     });
//     for (const inventory of inventories) {
//       if (inventory.product.minValue !== null && inventory.product.minValue !== undefined) {
//         await prisma.inventory.update({
//           where: { id: inventory.id },
//           data: { quantity: inventory.product.minValue },
//         });
//         await prisma.stockHistory.create({
//           data: {
//             productId: inventory.productId,
//             outletId: inventory.outletId,
//             quantity: inventory.product.minValue,
//             action: "UPDATE",
//           },
//         });
//       }
//     }
//     console.log("Midnight stock reset completed successfully");
//   } catch (error) {
//     console.error("Error during midnight stock reset:", error);
//   }
// });

export const getProducts = async (req, res, next) => {
  try {
    const outletId = parseInt(req.params.outletId);
    const products = await prisma.product.findMany({
      where: outletId ? { outletId } : {},
      include: {
        inventory: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Internal Server Error" });
  }
};

export const addProduct = async (req, res, next) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: "Image upload failed", error: err.message });
      }

      const { name, description, price, outletId, category, threshold } = req.body;
      if (!name || !description || !price || !outletId || !category) {
        return res.status(400).json({ message: "Provide all the fields" });
      }

      const crtName = name.toLowerCase();
      const existingProduct = await prisma.product.findUnique({ where: { name: crtName } });
      if (existingProduct) {
        return res.status(400).json({ message: "Product already available" });
      }

      let imageUrl = null;
      if (req.file) {
        imageUrl = await uploadImage(req.file.buffer, req.file.originalname);
      }

      const newProduct = await prisma.product.create({
        data: {
          name: crtName,
          description,
          price: parseFloat(price),
          imageUrl,
          outletId: parseInt(outletId),
          category,
          inventory: {
            create: {
              outletId: parseInt(outletId),
              threshold: parseInt(threshold) || 10,
              quantity: 0,
            },
          },
        },
      });

      await prisma.stockHistory.create({
        data: {
          productId: newProduct.id,
          outletId: parseInt(outletId),
          quantity: 0,
          action: "ADD",
        },
      });

      return res.status(201).json({
        message: "Product Created",
        product: {
          id: newProduct.id,
          name: newProduct.name,
          price: newProduct.price,
          imageUrl: newProduct.imageUrl,
        },
      });
    });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteProduct = async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Provide productID" });
  try {
    const products = await prisma.product.deleteMany({
      where: { id },
    });
    if (products.count === 0) {
      return res.status(404).json({ message: "No product found with that id" });
    }
    res.status(200).json({ message: `${products.count} product(s) deleted successfully` });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ... other imports remain the same

export const updateProduct = async (req, res, next) => {
    try {
        // Use multer middleware to handle the form data
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ message: "Image upload failed", error: err.message });
            }

            const productId = parseInt(req.params.id);
            const { name, description, price, category, threshold, outletId } = req.body;

            if (!name || !description || !price || !category || !outletId) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: name, description, price, category, outletId",
                });
            }

            // The rest of your existing update logic goes here...
            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be greater than 0",
                });
            }
            const existingProduct = await prisma.product.findUnique({
                where: { id: productId },
                include: { inventory: true },
            });
            if (!existingProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }
            const crtName = name.toLowerCase();
            const inventoryThreshold = parseInt(threshold) || 10;
            const duplicateProduct = await prisma.product.findFirst({
                where: {
                    name: crtName,
                    NOT: { id: productId },
                },
            });
            if (duplicateProduct) {
                return res.status(400).json({
                    success: false,
                    message: "Product with this name already exists",
                });
            }
            
            // Handle image update
            let imageUrl = existingProduct.imageUrl;
            if (req.file) {
                 // You might want to delete the old image from S3 here
                imageUrl = await uploadImage(req.file.buffer, req.file.originalname);
            }

            const updatedProduct = await prisma.$transaction(async (tx) => {
                const product = await tx.product.update({
                    where: { id: productId },
                    data: {
                        name: crtName,
                        description,
                        price: parseFloat(price),
                        imageUrl, // Make sure to save the new image URL
                        category,
                        outletId: parseInt(outletId),
                    },
                });
                await tx.inventory.update({
                    where: { productId: productId },
                    data: {
                        threshold: inventoryThreshold,
                        outletId: parseInt(outletId),
                    },
                });
                await tx.stockHistory.create({
                    data: {
                        productId: productId,
                        outletId: parseInt(outletId),
                        quantity: existingProduct.inventory.quantity,
                        action: "UPDATE",
                    },
                });
                return product;
            });

            const productWithInventory = await prisma.product.findUnique({
                where: { id: productId },
                include: { inventory: true },
            });

            res.status(200).json({
                success: true,
                message: "Product updated successfully",
                data: productWithInventory,
            });
        });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};