import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testManualOrder() {
  const outletId = 1;
  // Use a product ID that we know exists in the DB. Let's find one first.
  const product = await prisma.product.findFirst({
    where: { outletId: outletId, recipeConfigured: true },
    include: { recipes: true }
  });

  if (!product) {
    console.log("No product found with a recipe for outlet 1");
    return;
  }

  console.log("Testing with product:", product.id);

  const items = [{
    productId: product.id,
    quantity: 1,
    unitPrice: product.price
  }];

  try {
    const order = await prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const createdOrder = await tx.order.create({
        data: {
          outletId: outletId,
          totalAmount: product.price,
          paymentMethod: 'CASH',
          status: "DELIVERED",
          type: "MANUAL",
          customerId: null,
          deliveryDate: today,
          isPreOrder: false,
          deliveredAt: new Date(),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              status: "DELIVERED",
            })),
          },
        },
        include: { items: true },
      });

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
              outletId: outletId,
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

    console.log("Order created successfully:", order.id);
  } catch (error) {
    console.error("TRANSACTION FAILED:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testManualOrder();
