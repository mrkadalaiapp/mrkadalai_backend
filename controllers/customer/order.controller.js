import prisma from "../../prisma/client.js";
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getCurrentISTAsUTC } from "../../utils/timezone.js";

// export const customerAppOrder1 = async (req, res) => {
//   try {
//     const { totalAmount, paymentMethod, deliverySlot, items, outletId } = req.body;
//     const userId = req.user.id;

//     if (!totalAmount || !paymentMethod || !deliverySlot || !items || !Array.isArray(items) || items.length === 0 || !outletId) {
//       return res.status(400).json({ 
//         message: "Invalid input: totalAmount, paymentMethod, deliverySlot, outletId, and items are required" 
//       });
//     }

//     if (typeof outletId !== 'number' || outletId <= 0) {
//       return res.status(400).json({ 
//         message: "Invalid outletId: must be a positive number" 
//       });
//     }

//     const validPaymentMethods = ['WALLET', 'UPI', 'CARD'];
//     if (!validPaymentMethods.includes(paymentMethod)) {
//       return res.status(400).json({ 
//         message: "Invalid payment method" 
//       });
//     }
//     const validDeliverySlots = ['SLOT_11_12', 'SLOT_12_13', 'SLOT_13_14', 'SLOT_14_15', 'SLOT_15_16', 'SLOT_16_17'];
//     if (!validDeliverySlots.includes(deliverySlot)) {
//       return res.status(400).json({ 
//         message: "Invalid delivery slot" 
//       });
//     }

//     const outlet = await prisma.outlet.findUnique({
//       where: { id: outletId },
//       select: { id: true, isActive: true, name: true }
//     });

//     if (!outlet) {
//       return res.status(404).json({ message: "Outlet not found" });
//     }

//     if (!outlet.isActive) {
//       return res.status(400).json({ message: "Selected outlet is currently inactive" });
//     }

//     const customer = await prisma.customerDetails.findUnique({
//       where: { userId },
//       select: { id: true },
//     });

//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     const customerId = customer.id;

//     let walletTransaction = null;
//     if (paymentMethod === 'WALLET') {
//       const wallet = await prisma.wallet.findUnique({
//         where: { customerId }
//       });

//       if (!wallet) {
//         return res.status(404).json({ message: "Wallet not found" });
//       }

//       if (wallet.balance < totalAmount) {
//         return res.status(400).json({ 
//           message: "Insufficient wallet balance", 
//           availableBalance: wallet.balance,
//           requiredAmount: totalAmount
//         });
//       }

//       // Deduct amount from wallet
//       await prisma.wallet.update({
//         where: { customerId },
//         data: {
//           balance: wallet.balance - totalAmount,
//           totalUsed: wallet.totalUsed + totalAmount,
//           lastOrder: new Date()
//         }
//       });

//       // Create wallet transaction record
//       walletTransaction = await prisma.walletTransaction.create({
//         data: {
//           walletId: wallet.id,
//           amount: -totalAmount,
//           method: 'WALLET',
//           status: 'DEDUCT'
//         }
//       });
//     }

//     const deliveryDate = new Date();
//     deliveryDate.setHours(0, 0, 0, 0); 

//     const order = await prisma.order.create({
//       data: {
//         customerId,
//         outletId, 
//         totalAmount,
//         paymentMethod,
//         status: 'PENDING',
//         type: 'APP',
//         deliveryDate,
//         deliverySlot,
//         isPreOrder: false,
//         items: {
//           create: items.map(item => ({
//             productId: item.productId,
//             quantity: item.quantity,
//             unitPrice: item.unitPrice,
//             status: 'NOT_DELIVERED'
//           }))
//         }
//       },
//       include: {
//         items: {
//           include: {
//             product: true
//           }
//         },
//         customer: {
//           include: {
//             user: {
//               select: {
//                 name: true,
//                 email: true,
//                 phone: true
//               }
//             }
//           }
//         },
//         outlet: {
//           select: {
//             id: true,
//             name: true,
//             address: true
//           }
//         }
//       }
//     });

//     const cart = await prisma.cart.findUnique({
//       where: { customerId }
//     });

//     if (cart) {
//       await prisma.cartItem.deleteMany({
//         where: { cartId: cart.id }
//       });
//     }
//     for (const item of items) {
//       const inventory = await prisma.inventory.findUnique({
//         where: { productId: item.productId }
//       });

//       if (inventory && inventory.quantity >= item.quantity) {
//         await prisma.inventory.update({
//           where: { productId: item.productId },
//           data: {
//             quantity: inventory.quantity - item.quantity
//           }
//         });

//         await prisma.stockHistory.create({
//           data: {
//             productId: item.productId,
//             outletId, 
//             quantity: item.quantity,
//             action: 'REMOVE'
//           }
//         });
//       }
//     }

//     res.status(201).json({
//       message: 'Order placed successfully',
//       order: {
//         id: order.id,
//         orderNumber: `#ORD-${order.id.toString().padStart(6, '0')}`,
//         totalAmount: order.totalAmount,
//         paymentMethod: order.paymentMethod,
//         status: order.status,
//         deliverySlot: order.deliverySlot,
//         deliveryDate: order.deliveryDate,
//         createdAt: order.createdAt,
//         items: order.items,
//         customer: order.customer,
//         outlet: order.outlet
//       },
//       walletTransaction: walletTransaction ? {
//         id: walletTransaction.id,
//         amount: walletTransaction.amount,
//         method: walletTransaction.method,
//         status: walletTransaction.status,
//         createdAt: walletTransaction.createdAt
//       } : null
//     });

//   } catch (error) {
//     console.error("Error creating order:", error);

//     if (error.code && paymentMethod === 'WALLET') {
//       try {
//         const customer = await prisma.customerDetails.findUnique({
//           where: { userId: req.user.id },
//           select: { id: true }
//         });

//         if (customer) {
//           const wallet = await prisma.wallet.findUnique({
//             where: { customerId: customer.id }
//           });

//           if (wallet) {
//             await prisma.wallet.update({
//               where: { customerId: customer.id },
//               data: {
//                 balance: wallet.balance + totalAmount,
//                 totalUsed: Math.max(0, wallet.totalUsed - totalAmount)
//               }
//             });

//             // Create refund transaction record
//             await prisma.walletTransaction.create({
//               data: {
//                 walletId: wallet.id,
//                 amount: totalAmount,
//                 method: 'WALLET',
//                 status: 'RECHARGE'
//               }
//             });
//           }
//         }
//       } catch (refundError) {
//         console.error("Error refunding wallet:", refundError);
//       }
//     }

//     return res.status(500).json({ 
//       message: "Failed to place order", 
//       error: error.message 
//     });
//   }
// };

// export const customerAppOrder = async (req, res) => {
//   const { totalAmount, paymentMethod, deliverySlot, items, outletId } = req.body;
//   const userId = req.user.id;

//   try {
//     const result = await prisma.$transaction(async (tx) => {
//       // Input validation
//       if (!totalAmount || !paymentMethod || !deliverySlot || !items || !Array.isArray(items) || items.length === 0 || !outletId) {
//         throw new Error("Invalid input: totalAmount, paymentMethod, deliverySlot, outletId, and items are required");
//       }

//       if (typeof outletId !== 'number' || outletId <= 0) {
//         throw new Error("Invalid outletId: must be a positive number");
//       }

//       const validPaymentMethods = ['WALLET', 'UPI', 'CARD'];
//       if (!validPaymentMethods.includes(paymentMethod)) {
//         throw new Error("Invalid payment method");
//       }

//       const validDeliverySlots = ['SLOT_11_12', 'SLOT_12_13', 'SLOT_13_14', 'SLOT_14_15', 'SLOT_15_16', 'SLOT_16_17'];
//       if (!validDeliverySlots.includes(deliverySlot)) {
//         throw new Error("Invalid delivery slot");
//       }

//       // Validate outlet
//       const outlet = await tx.outlet.findUnique({
//         where: { id: outletId },
//         select: { id: true, isActive: true }
//       });

//       if (!outlet) throw new Error("Outlet not found");
//       if (!outlet.isActive) throw new Error("Selected outlet is currently inactive");

//       // Validate customer
//       const customer = await tx.customerDetails.findUnique({
//         where: { userId },
//         select: { id: true }
//       });
//       if (!customer) throw new Error("Customer not found");

//       const customerId = customer.id;

//       // Inventory check
//       const inventoryUpdates = [];
//       const stockValidationErrors = [];

//       for (const item of items) {
//         const inventory = await tx.inventory.findUnique({
//           where: { productId: item.productId }
//         });

//         if (!inventory) {
//           stockValidationErrors.push(`Product ${item.productId} not found`);
//         } else if (inventory.quantity < item.quantity) {
//           stockValidationErrors.push(`Insufficient stock for product ${item.productId}`);
//         } else {
//           inventoryUpdates.push({
//             productId: item.productId,
//             outletId,
//             currentStock: inventory.quantity,
//             requestedQuantity: item.quantity,
//             newStock: inventory.quantity - item.quantity
//           });
//         }
//       }

//       if (stockValidationErrors.length > 0) {
//         throw new Error(`Stock validation failed: ${stockValidationErrors.join(', ')}`);
//       }

//       // Wallet payment
//       let walletTransaction = null;

//       if (paymentMethod === 'WALLET') {
//         const wallet = await tx.wallet.findUnique({
//           where: { customerId }
//         });

//         if (!wallet) throw new Error("Wallet not found");

//         if (wallet.balance < totalAmount) {
//           throw new Error(`Insufficient wallet balance. Available: ${wallet.balance}, Required: ${totalAmount}`);
//         }

//         await tx.wallet.update({
//           where: { customerId },
//           data: {
//             balance: wallet.balance - totalAmount,
//             totalUsed: wallet.totalUsed + totalAmount,
//             lastOrder: new Date()
//           }
//         });

//         walletTransaction = await tx.walletTransaction.create({
//           data: {
//             walletId: wallet.id,
//             amount: -totalAmount,
//             method: 'WALLET',
//             status: 'DEDUCT'
//           }
//         });
//       }

//       // Inventory deduction
//       for (const update of inventoryUpdates) {
//         await tx.inventory.update({
//           where: { productId: update.productId },
//           data: { quantity: update.newStock }
//         });

//         await tx.stockHistory.create({
//           data: {
//             productId: update.productId,
//             outletId: update.outletId,
//             quantity: update.requestedQuantity,
//             action: 'REMOVE'
//           }
//         });
//       }

//       // Create order
//       const deliveryDate = new Date();
//       deliveryDate.setHours(0, 0, 0, 0);

//       const order = await tx.order.create({
//         data: {
//           customerId,
//           outletId,
//           totalAmount,
//           paymentMethod,
//           status: 'PENDING',
//           type: 'APP',
//           deliveryDate,
//           deliverySlot,
//           isPreOrder: false,
//           items: {
//             create: items.map(item => ({
//               productId: item.productId,
//               quantity: item.quantity,
//               unitPrice: item.unitPrice,
//               status: 'NOT_DELIVERED'
//             }))
//           }
//         },
//         include: {
//           items: { include: { product: true } },
//           customer: {
//             include: {
//               user: {
//                 select: {
//                   name: true,
//                   email: true,
//                   phone: true
//                 }
//               }
//             }
//           },
//           outlet: {
//             select: {
//               id: true,
//               name: true,
//               address: true
//             }
//           }
//         }
//       });

//       // Clear cart
//       const cart = await tx.cart.findUnique({
//         where: { customerId }
//       });

//       if (cart) {
//         await tx.cartItem.deleteMany({
//           where: { cartId: cart.id }
//         });
//       }

//       return { order, walletTransaction, stockUpdates: inventoryUpdates };
//     });

//     // Success response
//     res.status(201).json({
//       message: 'Order placed successfully',
//       order: {
//         id: result.order.id,
//         orderNumber: `#ORD-${result.order.id.toString().padStart(6, '0')}`,
//         totalAmount: result.order.totalAmount,
//         paymentMethod: result.order.paymentMethod,
//         status: result.order.status,
//         deliverySlot: result.order.deliverySlot,
//         deliveryDate: result.order.deliveryDate,
//         createdAt: result.order.createdAt,
//         items: result.order.items,
//         customer: result.order.customer,
//         outlet: result.order.outlet
//       },
//       walletTransaction: result.walletTransaction ? {
//         id: result.walletTransaction.id,
//         amount: result.walletTransaction.amount,
//         method: result.walletTransaction.method,
//         status: result.walletTransaction.status,
//         createdAt: result.walletTransaction.createdAt
//       } : null,
//       stockUpdates: result.stockUpdates
//     });

//   } catch (error) {
//     console.error("Error placing order:", error.message);

//     if (error.message.includes('wallet balance')) {
//       return res.status(400).json({
//         message: 'Insufficient wallet balance',
//         error: error.message,
//         type: 'WALLET_ERROR'
//       });
//     }

//     if (error.message.includes('Stock validation failed')) {
//       return res.status(400).json({
//         message: 'Some items are out of stock',
//         error: error.message,
//         type: 'STOCK_ERROR'
//       });
//     }

//     res.status(500).json({
//       message: 'Failed to place order',
//       error: error.message,
//       type: 'SERVER_ERROR'
//     });
//   }
// };

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    const userId = req.user.id;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid amount",
        error: "Amount must be greater than 0"
      });
    }

    // Verify customer exists
    const customer = await prisma.customerDetails.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount), // Amount in paise
      currency: currency,
      receipt: receipt || `order_${new Date().getTime()}`,
      notes: {
        customer_id: customer.id,
        user_id: userId
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(201).json({
      message: "Razorpay order created successfully",
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        created_at: razorpayOrder.created_at
      }
    });

  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      message: "Failed to create Razorpay order",
      error: error.message
    });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        message: "Payment verification failed",
        error: "Invalid signature"
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    res.status(200).json({
      message: "Payment verified successfully",
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        captured: payment.captured,
        created_at: payment.created_at
      }
    });

  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({
      message: "Payment verification failed",
      error: error.message
    });
  }
};


export const customerAppOrder = async (req, res) => {
  const transaction = await prisma.$transaction(async (tx) => {
    try {
      const {
        totalAmount,
        paymentMethod,
        deliverySlot,
        items,
        outletId,
        couponCode,
        paymentDetails,
        requestedDeliveryDate
      } = req.body;
      const userId = req.user.id;

      if (!totalAmount || !paymentMethod || !deliverySlot || !items || !Array.isArray(items) || items.length === 0 || !outletId) {
        throw new Error("Invalid input: totalAmount, paymentMethod, deliverySlot, outletId, and items are required");
      }
      if (typeof outletId !== 'number' || outletId <= 0) {
        throw new Error("Invalid outletId: must be a positive number");
      }
      const validPaymentMethods = ['WALLET', 'UPI', 'CARD', 'CASH'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        throw new Error("Invalid payment method");
      }
      const validDeliverySlots = ['SLOT_11_12', 'SLOT_12_13', 'SLOT_13_14', 'SLOT_14_15', 'SLOT_15_16', 'SLOT_16_17'];
      if (!validDeliverySlots.includes(deliverySlot)) {
        throw new Error("Invalid delivery slot");
      }

      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: { id: true, isActive: true, name: true },
      });
      if (!outlet) {
        throw new Error("Outlet not found");
      }
      if (!outlet.isActive) {
        throw new Error("Selected outlet is currently inactive");
      }

      const customer = await tx.customerDetails.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error("Customer not found");
      }
      const customerId = customer.id;

      // Calculate ORIGINAL cart total from items (before any discount)
      // This ensures we validate minimum order on actual cart value, not discounted amount
      let originalCartTotal = 0;
      for (const item of items) {
        if (!item.productId || !item.quantity || !item.unitPrice) {
          throw new Error("Invalid item data: productId, quantity, and unitPrice are required");
        }
        originalCartTotal += item.quantity * item.unitPrice;
      }
      // Round to 2 decimal places to avoid floating point issues
      originalCartTotal = Math.round(originalCartTotal * 100) / 100;

      // Validate that provided totalAmount matches calculated originalCartTotal (within small tolerance)
      // This ensures frontend isn't sending discounted amount as totalAmount
      if (Math.abs(totalAmount - originalCartTotal) > 0.01) {
        throw new Error(`Cart total mismatch. Calculated: ₹${originalCartTotal}, Provided: ₹${totalAmount}`);
      }

      // Calculate coupon discount BEFORE payment verification
      // Industry standard: Minimum order value is checked on ORIGINAL amount (before discount)
      // Payment verification uses final amount (after discount)
      let finalTotalAmount = originalCartTotal;
      let couponDiscount = 0;
      let coupon = null;
      if (couponCode) {
        coupon = await tx.coupon.findUnique({
          where: { code: couponCode },
        });
        if (!coupon || !coupon.isActive) {
          throw new Error("Invalid or inactive coupon");
        }
        // Check coupon validity using IST timezone
        const currentISTAsUTC = getCurrentISTAsUTC();
        if (currentISTAsUTC < coupon.validFrom || currentISTAsUTC > coupon.validUntil) {
          throw new Error("Coupon is not valid for the current date and time (IST)");
        }
        if (coupon.outletId !== outletId && coupon.outletId !== null) {
          throw new Error("Coupon is not valid for the selected outlet");
        }
        const existingUsage = await tx.couponUsage.findFirst({
          where: { userId, couponId: coupon.id },
        });
        if (existingUsage) {
          throw new Error("Coupon already used by this customer");
        }
        if (coupon.usedCount >= coupon.usageLimit) {
          throw new Error("Coupon usage limit reached");
        }
        // IMPORTANT: Check minimum order value on ORIGINAL cart total (before discount)
        // This is the industry standard - ensures order qualifies even if discount brings it below minimum
        // Example: Min order ₹100, Cart ₹120, Discount 25% → Final ₹90 (valid, as original ₹120 >= ₹100)
        if (originalCartTotal < coupon.minOrderValue) {
          throw new Error(`Minimum order value of ₹${coupon.minOrderValue} required. Your cart value is ₹${originalCartTotal}`);
        }
        if (coupon.rewardValue > 0) {
          if (coupon.rewardValue < 1) {
            couponDiscount = originalCartTotal * coupon.rewardValue; // Percentage discount
          } else if (coupon.rewardValue <= originalCartTotal) {
            couponDiscount = coupon.rewardValue; // Fixed amount discount
          } else {
            // Fixed discount exceeds cart total, cap at cart total
            couponDiscount = originalCartTotal;
          }
        }
        finalTotalAmount = originalCartTotal - couponDiscount;
        // Ensure final amount doesn't go negative
        if (finalTotalAmount < 0) {
          finalTotalAmount = 0;
        }
      } else {
        // No coupon provided, use originalCartTotal as finalTotalAmount
        finalTotalAmount = originalCartTotal;
      }

      // Verify payment amount against FINAL amount (after discount)
      let razorpayPaymentId = null;
      if ((paymentMethod === 'UPI' || paymentMethod === 'CARD') && paymentDetails) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          throw new Error("Invalid payment details for online payment");
        }
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", razorpay.key_secret) // Use razorpay instance secret
          .update(body.toString())
          .digest("hex");
        const isAuthentic = expectedSignature === razorpay_signature;
        if (!isAuthentic) {
          throw new Error("Payment verification failed: Invalid signature");
        }
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.status !== 'captured' && payment.status !== 'authorized') {
          throw new Error("Payment not successful");
        }
        const paidAmount = payment.amount / 100;
        // Compare against finalTotalAmount (after discount), not totalAmount
        if (Math.abs(paidAmount - finalTotalAmount) > 0.01) {
          throw new Error(`Payment amount mismatch. Expected: ₹${finalTotalAmount}, Paid: ₹${paidAmount}`);
        }
        razorpayPaymentId = razorpay_payment_id;
      }

      const stockValidationErrors = [];
      const aggregatedRequirements = {};

      for (const item of items) {
        const recipe = await tx.productRecipe.findMany({
          where: { productId: item.productId },
          include: { inventoryItem: true },
        });

        if (recipe.length === 0) {
          stockValidationErrors.push(`Product #${item.productId} recipe mapping not configured`);
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
            };
          }
          aggregatedRequirements[itemId].required += requiredQty;
        }
      }

      for (const [itemId, data] of Object.entries(aggregatedRequirements)) {
        if (data.available < data.required) {
          stockValidationErrors.push(
            `Insufficient raw material for ${data.itemName}. Available: ${data.available}, Required: ${data.required}`
          );
        }
      }

      if (stockValidationErrors.length > 0) {
        throw new Error(`Stock validation failed: ${stockValidationErrors.join(' | ')}`);
      }

      let walletTransaction = null;
      if (paymentMethod === 'WALLET') {
        const wallet = await tx.wallet.findUnique({
          where: { customerId },
        });
        if (!wallet) {
          throw new Error("Wallet not found");
        }
        if (wallet.balance < finalTotalAmount) {
          throw new Error(`Insufficient wallet balance. Available: ${wallet.balance}, Required: ${finalTotalAmount}`);
        }
        await tx.wallet.update({
          where: { customerId },
          data: {
            balance: wallet.balance - finalTotalAmount,
            totalUsed: wallet.totalUsed + finalTotalAmount,
            lastOrder: new Date(),
          },
        });
        walletTransaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -finalTotalAmount,
            method: 'WALLET',
            status: 'DEDUCT',
          },
        });
      }

      // Inventory deductions are deferred until after the Order is successfully created using tx.inventoryItem!

      const deliveryInput = requestedDeliveryDate ?? req.body.deliveryDate ?? req.body.deliverydate;
      let orderDeliveryDate;
      let isPreOrder = false;

      if (deliveryInput) {
        // Parse the requested delivery date
        orderDeliveryDate = new Date(deliveryInput);

        // Check if it's a preorder (not today)
        const today = new Date();

        isPreOrder = orderDeliveryDate.getTime() !== today.getTime();
      } else {
        // Default to today if no delivery date provided
        orderDeliveryDate = new Date();
        isPreOrder = false;
      }

      const order = await tx.order.create({
        data: {
          customerId,
          outletId,
          totalAmount: finalTotalAmount,
          paymentMethod,
          status: 'PENDING',
          type: 'APP',
          deliveryDate: orderDeliveryDate,
          deliverySlot,
          isPreOrder,
          razorpayPaymentId,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              status: 'NOT_DELIVERED',
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          customer: {
            include: {
              user: {
                select: { name: true, email: true, phone: true },
              },
            },
          },
          outlet: { select: { id: true, name: true, address: true } },
        },
      });

      await tx.customerDetails.update({
        where: { userId },
        data: { orderCount: { increment: 1 } },
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
              movementType: 'OUTWARD',
              quantity: deductQty,
              unit: row.unit,
              source: 'APP_ORDER',
              referenceId: `ORD-${order.id}`,
              remarks: `App order: ${item.quantity}x product #${item.productId}`,
            },
          });
        }
      }

      const cart = await tx.cart.findUnique({
        where: { customerId },
      });
      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      if (coupon) {
        await tx.couponUsage.create({
          data: {
            couponId: coupon.id,
            orderId: order.id,
            userId,
            amount: couponDiscount,
          },
        });
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: coupon.usedCount + 1 },
        });
      }

      return {
        order,
        walletTransaction,
        stockUpdates: [],
        couponDiscount,
        razorpayPaymentId,
      };
    } catch (error) {
      throw error; // This will trigger transaction rollback
    }
  }, { timeout: 15000 });

  try {
    const result = await transaction;
    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        id: result.order.id,
        orderNumber: `#ORD-${result.order.id.toString().padStart(6, '0')}`,
        totalAmount: result.order.totalAmount,
        paymentMethod: result.order.paymentMethod,
        status: result.order.status,
        deliverySlot: result.order.deliverySlot,
        deliveryDate: result.order.deliveryDate,
        createdAt: result.order.createdAt,
        items: result.order.items,
        customer: result.order.customer,
        outlet: result.order.outlet,
        razorpayPaymentId: result.razorpayPaymentId,
      },
      walletTransaction: result.walletTransaction
        ? {
          id: result.walletTransaction.id,
          amount: result.walletTransaction.amount,
          method: result.walletTransaction.method,
          status: result.walletTransaction.status,
          createdAt: result.walletTransaction.createdAt,
        }
        : null,
      stockUpdates: result.stockUpdates,
      couponDiscount: result.couponDiscount,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    if (error.message.includes('Stock validation failed')) {
      return res.status(400).json({
        message: 'Some items are out of stock',
        error: error.message,
        type: 'STOCK_ERROR',
      });
    }
    if (error.message.includes('Insufficient wallet balance')) {
      return res.status(400).json({
        message: 'Insufficient wallet balance',
        error: error.message,
        type: 'WALLET_ERROR',
      });
    }
    if (error.message.includes('Payment verification failed')) {
      return res.status(400).json({
        message: 'Payment verification failed',
        error: error.message,
        type: 'PAYMENT_ERROR',
      });
    }
    if (error.message.includes('Coupon is not valid for the selected outlet')) {
      return res.status(400).json({
        message: 'Coupon is not valid for the selected outlet',
        error: error.message,
        type: 'COUPON_ERROR',
      });
    }
    return res.status(500).json({
      message: 'Failed to place order',
      error: error.message,
      type: 'SERVER_ERROR',
    });
  }
};



export const customerAppOngoingOrderList = async (req, res) => {
  try {
    const userId = req.user.id;
    const customer = await prisma.customerDetails.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customerId = customer.id;
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: 'PENDING',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true
              },
            },
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!orders || orders.length === 0) {
      return res.status(200).json({ message: "No ongoing orders found", orders: [] });
    }

    res.status(200).json({ message: "Ongoing orders retrieved", orders });
  } catch (error) {
    console.error("Error retrieving ongoing orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const customerAppOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const customer = await prisma.customerDetails.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customerId = customer.id;

    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: {
          in: ['DELIVERED', 'CANCELLED','PARTIALLY_DELIVERED','PARTIAL_CANCEL'],
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true
              },
            },
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ message: "Order history retrieved", orders });
  } catch (error) {
    console.error("Error retrieving order history:", error.message, error.stack);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const customerAppCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const customer = await prisma.customerDetails.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(orderId),
        customerId: customer.id,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        message: `Cannot cancel order. Order status is ${order.status}`,
      });
    }
    const result = await prisma.$transaction(async (tx) => {
      const cancelledOrder = await tx.order.update({
        where: { id: parseInt(orderId) },
        data: {
          status: 'CANCELLED',
          deliveredAt: null, // Reset deliveredAt when order is cancelled
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
          outlet: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });
      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            outletId: order.outletId,
          },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            outletId: order.outletId,
            quantity: item.quantity,
            action: 'ADD',
            timestamp: new Date(),
          },
        });
      }
      if (order.paymentMethod === 'WALLET' || order.paymentMethod === 'UPI' || order.paymentMethod === 'CARD') {
        let wallet = await tx.wallet.findUnique({
          where: { customerId: customer.id },
        });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              customerId: customer.id,
              balance: 0,
              totalRecharged: 0,
              totalUsed: 0,
            },
          });
        }
        await tx.wallet.update({
          where: { customerId: customer.id },
          data: {
            balance: {
              increment: order.totalAmount,
            },
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: order.totalAmount,
            method: order.paymentMethod,
            status: 'RECHARGE',
            createdAt: new Date(),
          },
        });
      }
      // Removed coupon refund logic
      return cancelledOrder;
    });
    res.status(200).json({
      message: "Order cancelled successfully",
      order: result,
      refundAmount: order.totalAmount,
      refundMethod: order.paymentMethod === 'CASH' ? 'CASH' : 'WALLET',
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};