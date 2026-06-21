import prisma from "../../prisma/client.js";

// Sales Trend - Revenue by dates
export const getSalesTrend = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const orders = await prisma.order.findMany({
            where: {
                outletId: Number(outletId),
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                },
                status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }
            },
            select: {
                totalAmount: true,
                createdAt: true
            }
        });

        // Group by date
        const dailyRevenue = {};
        for (const order of orders) {
            const date = order.createdAt.toISOString().slice(0, 10);
            dailyRevenue[date] = (dailyRevenue[date] || 0) + Number(order.totalAmount);
        }

        const result = Object.entries(dailyRevenue)
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch sales trend", error: err.message });
    }
};

// Order Type Breakdown - Manual vs App orders count
export const getOrderTypeBreakdown = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const appOrders = await prisma.order.count({
            where: {
                outletId: Number(outletId),
                type: 'APP',
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                }
            }
        });

        const manualOrders = await prisma.order.count({
            where: {
                outletId: Number(outletId),
                type: 'MANUAL',
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                }
            }
        });

        res.status(200).json({
            appOrders,
            manualOrders
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch order type breakdown", error: err.message });
    }
};

// New Customers vs Dates
export const getNewCustomersTrend = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const newCustomers = await prisma.user.findMany({
            where: {
                outletId: Number(outletId),
                role: 'CUSTOMER',
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                }
            },
            select: {
                createdAt: true
            }
        });

        // Group by date
        const dailyNewCustomers = {};
        for (const customer of newCustomers) {
            const date = customer.createdAt.toISOString().slice(0, 10);
            dailyNewCustomers[date] = (dailyNewCustomers[date] || 0) + 1;
        }

        const result = Object.entries(dailyNewCustomers)
            .map(([date, newCustomers]) => ({ date, newCustomers }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch new customers trend", error: err.message });
    }
};

// Category Breakdown - Meals, Starters, Desserts, Beverages, Combo
export const getCategoryBreakdown = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const categoryData = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                order: {
                    outletId: Number(outletId),
                    createdAt: {
                        gte: new Date(from),
                        lte: new Date(to)
                    },
                    status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }
                }
            },
            _sum: {
                quantity: true
            }
        });

        const productIds = categoryData.map(item => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, category: true }
        });

        const productCategoryMap = Object.fromEntries(
            products.map(p => [p.id, p.category])
        );


        const categoryTotals = {};
        for (const item of categoryData) {
            const category = productCategoryMap[item.productId];
            if (category) {
                categoryTotals[category] = (categoryTotals[category] || 0) + Number(item._sum.quantity || 0);
            }
        }

        const result = Object.entries(categoryTotals)
            .map(([category, orderCount]) => ({ category, orderCount }))
            .sort((a, b) => b.orderCount - a.orderCount);

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch category breakdown", error: err.message });
    }
};

// Delivery Time Orders - Orders by delivery time slots
export const getDeliveryTimeOrders = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const deliverySlotData = await prisma.order.groupBy({
            by: ['deliverySlot'],
            where: {
                outletId: Number(outletId),
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                },
                status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] },
                deliverySlot: { not: null }
            },
            _count: {
                id: true
            }
        });

        const result = deliverySlotData.map(item => ({
            deliverySlot: item.deliverySlot,
            orderCount: item._count.id
        })).sort((a, b) => a.deliverySlot.localeCompare(b.deliverySlot));

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch delivery time orders", error: err.message });
    }
};

// Cancellation and Refunds by date
export const getCancellationRefunds = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const cancelledOrders = await prisma.order.findMany({
            where: {
                outletId: Number(outletId),
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                },
                status: { in: ['CANCELLED', 'PARTIAL_CANCEL'] }
            },
            select: {
                createdAt: true,
                status: true
            }
        });

        const refunds = await prisma.walletTransaction.findMany({
            where: {
                status: 'DEDUCT',
                createdAt: {
                    gte: new Date(from),
                    lte: new Date(to)
                },
                wallet: {
                    customer: {
                        user: {
                            outletId: Number(outletId)
                        }
                    }
                }
            },
            select: {
                createdAt: true
            }
        });

        const dailyData = {};
        
        for (const order of cancelledOrders) {
            const date = order.createdAt.toISOString().slice(0, 10);
            if (!dailyData[date]) dailyData[date] = { cancellations: 0, refunds: 0 };
            dailyData[date].cancellations++;
        }

        for (const refund of refunds) {
            const date = refund.createdAt.toISOString().slice(0, 10);
            if (!dailyData[date]) dailyData[date] = { cancellations: 0, refunds: 0 };
            dailyData[date].refunds++;
        }

        const result = Object.entries(dailyData)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch cancellation refunds", error: err.message });
    }
};

// Quantity Sold by Dishes
export const getQuantitySold = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    if (!from || !to) {
        return res.status(400).json({ message: "from and to dates are required" });
    }

    try {
        const quantityData = await prisma.orderItem.groupBy({
            by: ['productId'],
            where: {
                order: {
                    outletId: Number(outletId),
                    createdAt: {
                        gte: new Date(from),
                        lte: new Date(to)
                    },
                    status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }
                }
            },
            _sum: {
                quantity: true
            }
        });
        
        const productIds = quantityData.map(item => item.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true }
        });

        const productNameMap = Object.fromEntries(
            products.map(p => [p.id, p.name])
        );

        const result = quantityData
            .map(item => ({
                productId: item.productId,
                productName: productNameMap[item.productId] || 'Unknown',
                quantitySold: item._sum.quantity || 0
            }))
            .sort((a, b) => b.quantitySold - a.quantitySold);

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch quantity sold", error: err.message });
    }
};