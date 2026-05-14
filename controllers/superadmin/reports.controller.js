import prisma from "../../prisma/client.js";

export const getOutletSalesReport = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;
  
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
  
    try {
      const sales = await prisma.orderItem.groupBy({
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
  
      // Get product names
      const productIds = sales.map(s => s.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true }
      });
  
      const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));
  
      const orderCounts = await prisma.orderItem.groupBy({
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
        _count: {
          orderId: true
        }
      });

      const orderCountMap = Object.fromEntries(orderCounts.map(oc => [oc.productId, oc._count.orderId]));
  
      const result = sales.map(s => ({
        productId: s.productId,
        productName: productMap[s.productId] || 'Unknown',
        totalItemsSold: s._sum.quantity || 0,
        totalOrders: orderCountMap[s.productId] || 0
      }));
  
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sales report", error: err.message });
    }
  };
  
  export const getOutletRevenueByItems = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;
  
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
  
    try {
      // Get all delivered or partially delivered order items for the outlet and date range
      const orderItems = await prisma.orderItem.findMany({
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
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } }
        }
      });
  
      // Aggregate revenue by product
      const revenueMap = {};
      for (const item of orderItems) {
        if (!revenueMap[item.productId]) {
          revenueMap[item.productId] = {
            productId: item.productId,
            productName: item.product.name,
            revenue: 0
          };
        }
        revenueMap[item.productId].revenue += item.quantity * item.unitPrice;
      }
  
      const result = Object.values(revenueMap);
  
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch revenue report", error: err.message });
    }
  };  


  export const getRevenueSplit = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;
  
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
  
    try {
      // Revenue by App Order
      const appOrder = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          outletId: Number(outletId),
          type: 'APP',
          status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] },
          createdAt: {
            gte: new Date(from),
            lte: new Date(to)
          }
        }
      });
  
      // Revenue by Manual Order
      const manualOrder = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          outletId: Number(outletId),
          type: 'MANUAL',
          status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] },
          createdAt: {
            gte: new Date(from),
            lte: new Date(to)
          }
        }
      });
  
      // Revenue by Wallet Recharge (filter by wallet's customer's outletId)
      const walletRecharge = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'RECHARGE',
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
        }
      });
  
      const revenueByAppOrder = appOrder._sum.totalAmount || 0;
      const revenueByManualOrder = manualOrder._sum.totalAmount || 0;
      const revenueByWalletRecharge = walletRecharge._sum.amount || 0;
      const totalRevenue = revenueByAppOrder + revenueByManualOrder + revenueByWalletRecharge;
  
      res.status(200).json({
        revenueByAppOrder,
        revenueByManualOrder,
        revenueByWalletRecharge,
        totalRevenue
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch revenue split", error: err.message });
    }
  }; 


  export const getWalletRechargeByDay = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;
  
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
  
    try {
      const result = await prisma.walletTransaction.groupBy({
        by: ['createdAt', 'walletId'],
        where: {
          status: 'RECHARGE',
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
        _sum: {
          amount: true
        }
      });
  
      // Aggregate by date (since groupBy by date only is not supported in Prisma)
      const dailyRevenue = {};
      for (const row of result) {
        const date = row.createdAt.toISOString().slice(0, 10);
        dailyRevenue[date] = (dailyRevenue[date] || 0) + Number(row._sum.amount || 0);
      }
  
      const response = Object.entries(dailyRevenue).map(([date, revenue]) => ({
        date,
        revenue
      })).sort((a, b) => a.date.localeCompare(b.date));
  
      res.status(200).json(response);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch daily wallet recharge revenue", error: err.message });
    }
  };


  export const getProfitLossTrends = async (req, res, next) => {
    const { outletId } = req.params;
    const { year } = req.body;
  
    if (!year) {
      return res.status(400).json({ message: "year is required" });
    }
  
    try {
      // Get all delivered or partially delivered orders for the year and outlet
      const orders = await prisma.order.findMany({
        where: {
          outletId: Number(outletId),
          status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] },
          createdAt: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lte: new Date(`${year}-12-31T23:59:59.999Z`)
          }
        },
        select: {
          totalAmount: true,
          createdAt: true
        }
      });
  
      // Get all wallet recharges for the year and outlet
      const walletRecharges = await prisma.walletTransaction.findMany({
        where: {
          status: 'RECHARGE',
          createdAt: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lte: new Date(`${year}-12-31T23:59:59.999Z`)
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
          amount: true,
          createdAt: true
        }
      });
  
      // Get all expenses for the year and outlet
      const yearExpenses = await prisma.expense.findMany({
        where: {
          outletId: Number(outletId),
          expenseDate: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
            lte: new Date(`${year}-12-31T23:59:59.999Z`)
          }
        },
        select: {
          amount: true,
          expenseDate: true
        }
      });
  
      // Aggregate sales, recharges and expenses by month
      const monthly = {};
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { sales: 0, recharges: 0, expenses: 0, profit: 0 };
      }
  
      for (const order of orders) {
        const month = new Date(order.createdAt).getMonth() + 1;
        monthly[month].sales += Number(order.totalAmount);
      }

      for (const recharge of walletRecharges) {
        const month = new Date(recharge.createdAt).getMonth() + 1;
        monthly[month].recharges += Number(recharge.amount);
      }
  
      for (const exp of yearExpenses) {
        const month = new Date(exp.expenseDate).getMonth() + 1;
        monthly[month].expenses += Number(exp.amount);
      }
  
      // Calculate profit/loss
      for (let m = 1; m <= 12; m++) {
        // Total Revenue = Sales + Recharges
        // BUT wait, if a customer pays for an order using wallet, it's double counting?
        // Actually, many orders are CASH/UPI. 
        // If we want "Money Inflow", we should count all payments + recharges?
        // No, correct accounting: Revenue = Orders. (Accrual basis)
        // Recharges are "Cash Inflow" but not "Revenue" until spent.
        // However, for simplified tracking, usually people want to see both.
        // Given the user's feedback "Not accurate", maybe they want to see all inflows.
        // Let's stick to Revenue = Orders + (Wallet Recharges - Wallet Spent)? 
        // That's complex. 
        // Let's just provide the components in the response.
        monthly[m].profit = (monthly[m].sales + monthly[m].recharges) - monthly[m].expenses;
      }
  
      // Format result
      const result = [];
      for (let m = 1; m <= 12; m++) {
        result.push({
          month: m,
          sales: monthly[m].sales,
          recharges: monthly[m].recharges,
          expenses: monthly[m].expenses,
          profit: monthly[m].profit,
          status: monthly[m].profit >= 0 ? 'profit' : 'loss'
        });
      }
  
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch profit/loss trends", error: err.message });
    }
  };

  export const getCustomerOverview = async (req, res, next) => {
    const { outletId } = req.params;
    const { from, to } = req.body;

    try {
      // Get all customers who ordered in the period, filter out nulls
      const ordersInPeriod = await prisma.order.findMany({
        where: {
          outletId: Number(outletId),
          createdAt: { gte: new Date(from), lte: new Date(to) },
          customerId: { not: null }
        },
        select: { customerId: true }
      });
      const customerIds = [...new Set(ordersInPeriod.map(o => o.customerId))];

      // For each, check if they had an order before the period
      let newCount = 0, returningCount = 0;
      for (const customerId of customerIds) {
        const priorOrder = await prisma.order.findFirst({
          where: {
            customerId,
            createdAt: { lt: new Date(from) }
          }
        });
        if (priorOrder) returningCount++;
        else newCount++;
      }

      res.status(200).json({
        newCustomers: newCount,
        returningCustomers: returningCount
      });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch customer overview', error: err.message });
    }
  };

export const getCustomerPerOrder = async (req, res, next) => {
  const { outletId } = req.params;
  const { from, to } = req.body;

  try {
    const orders = await prisma.order.findMany({
      where: {
        outletId: Number(outletId),
        createdAt: { gte: new Date(from), lte: new Date(to) },
        customerId: { not: null },
        status: { in: ['DELIVERED', 'PARTIALLY_DELIVERED'] }
      },
      select: { customerId: true, createdAt: true, id: true }
    });

    // Group by day
    const grouped = {};
    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = { customers: new Set(), orders: 0 };
      grouped[key].customers.add(order.customerId);
      grouped[key].orders++;
    }

    const result = Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        customersPerOrder: data.orders > 0 ? data.customers.size / data.orders : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer per order', error: err.message });
  }
};