import express  from'express';
import { addOutlets,getOutlets,removeOutlets } from '../controllers/superadmin/outlet.controller.js';
import { outletAddStaff,getOutletStaff,outletStaffPermission,outletDeleteStaff,outletUpdateStaff,getStaffById } from '../controllers/superadmin/staff.controller.js';
import { getProducts,addProduct,deleteProduct, updateProduct } from '../controllers/superadmin/product.controller.js';
import { outletTotalOrders } from '../controllers/superadmin/order.controller.js';
import { getStocks,addStock,deductStock,stockHistory} from '../controllers/superadmin/inventory.controller.js';
import { getExpenses, addExpense, uploadBillImage, getExpenseByDate, getExpenseCategories, createExpenseCategory, deleteExpenseCategory, getExpenseNames, createExpenseName, deleteExpenseName, getVendors, createVendor, deleteVendor } from '../controllers/superadmin/expense.controller.js';
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, manualAddStock, manualDeductStock, getInventoryItemHistory } from '../controllers/superadmin/inventoryItem.controller.js';
import { getProductRecipe, saveProductRecipe, deleteRecipeRow } from '../controllers/superadmin/recipe.controller.js';
import { getCustomersWithWallet,getRechargeHistoryByOutlet,getOrdersPaidViaWallet } from '../controllers/superadmin/wallet.controller.js';
import { getOutletCustomers } from '../controllers/superadmin/customer.controller.js';
import { getTickets,ticketClose } from '../controllers/superadmin/ticket.controller.js';
import { authenticateToken,authorizeRoles,restrictToSuperAdmin, restrictToSuperAdminOrAdmin, restrictToSuperAdminOrAdminOrCustomer } from '../middlewares/auth.middleware.js';
import { getOutletSalesReport,getOutletRevenueByItems,getRevenueSplit,getWalletRechargeByDay,getProfitLossTrends,getCustomerOverview,getCustomerPerOrder} from '../controllers/superadmin/reports.controller.js';
import { getDashboardOverview, getOrderSourceDistribution, getOrderStatusDistribution, getPeakTimeSlots, getRevenueTrend, getTopSellingItems, getPendingAdminVerifications, verifyAdmin, mapOutletsToAdmin, assignAdminPermissions,getVerifiedAdmins,verifyStaff,getUnverifiedStaff, getVerifiedStaff, getAdminDetails, deleteAdmin } from '../controllers/superadmin/dashboard.controller.js'
import { createCoupon, getCoupons, deleteCoupon } from '../controllers/superadmin/coupon.controller.js';
import { getAvailableDatesAndSlots, getOutletNonAvailabilityPreview, setOutletAvailability, getOutletAppFeatures, updateOutletAppFeatures } from '../controllers/superadmin/appmanagement.controller.js';
import { getLowStockNotifications } from '../controllers/superadmin/dashboard.controller.js';
import { 
  createScheduledNotification, 
  getScheduledNotifications, 
  cancelScheduledNotification, 
  sendImmediateNotification, 
  getNotificationStats,
  testFCMService,
  testSingleDeviceNotification
} from '../controllers/superadmin/notification.controller.js';

const superadminRouter = express.Router();

superadminRouter.get('/dashboard/', authenticateToken, authorizeRoles('SUPERADMIN'), (req, res) => {
  res.json({ message: 'Welcome to Admin Dashboard' });
});

//Outlet Management
superadminRouter.post('/add-outlet/', restrictToSuperAdmin, addOutlets);
superadminRouter.get('/get-outlets/', restrictToSuperAdminOrAdminOrCustomer, getOutlets);
superadminRouter.delete('/remove-outlet/:outletId/', restrictToSuperAdmin, removeOutlets);

//Staff Management
superadminRouter.post('/outlets/add-staff/', restrictToSuperAdminOrAdmin, outletAddStaff);
superadminRouter.post('/outlets/permissions/', restrictToSuperAdminOrAdmin, outletStaffPermission);
superadminRouter.get('/outlets/get-staffs/:outletId', restrictToSuperAdminOrAdmin, getOutletStaff);
superadminRouter.put('/outlets/update-staff/:staffId', restrictToSuperAdminOrAdmin, outletUpdateStaff);
superadminRouter.delete('/outlets/delete-staff/:staffId', restrictToSuperAdminOrAdmin, outletDeleteStaff);
superadminRouter.get('/outlets/staff/:staffId', restrictToSuperAdminOrAdmin, getStaffById);

//Product management
superadminRouter.get('/outlets/get-products/:outletId', restrictToSuperAdminOrAdmin, getProducts);
superadminRouter.post('/outlets/add-product/', restrictToSuperAdminOrAdmin, addProduct);
superadminRouter.delete('/outlets/delete-product/:id', restrictToSuperAdminOrAdmin, deleteProduct);
superadminRouter.put('/outlets/update-product/:id', restrictToSuperAdminOrAdmin, updateProduct);

//Order management
superadminRouter.get('/outlets/:outletId/orders/', restrictToSuperAdminOrAdmin, outletTotalOrders);

//Inventory management (legacy - product-based, kept for safety)
superadminRouter.get('/outlets/get-stocks/:outletId', restrictToSuperAdminOrAdmin, getStocks);
superadminRouter.post('/outlets/add-stocks/', restrictToSuperAdminOrAdmin, addStock);
superadminRouter.post('/outlets/deduct-stocks/', restrictToSuperAdminOrAdmin, deductStock);
superadminRouter.post('/outlets/get-stock-history', restrictToSuperAdminOrAdmin, stockHistory);

// New InventoryItem (raw-material) management
superadminRouter.get('/outlets/inventory-items/:outletId', restrictToSuperAdminOrAdmin, getInventoryItems);
superadminRouter.post('/outlets/inventory-items/', restrictToSuperAdminOrAdmin, createInventoryItem);
superadminRouter.put('/outlets/inventory-items/:id', restrictToSuperAdminOrAdmin, updateInventoryItem);
superadminRouter.delete('/outlets/inventory-items/:id', restrictToSuperAdminOrAdmin, deleteInventoryItem);
superadminRouter.post('/outlets/inventory-items/manual-add-stock', restrictToSuperAdminOrAdmin, manualAddStock);
superadminRouter.post('/outlets/inventory-items/manual-deduct-stock', restrictToSuperAdminOrAdmin, manualDeductStock);
superadminRouter.post('/outlets/inventory-items/history', restrictToSuperAdminOrAdmin, getInventoryItemHistory);

// Recipe management
superadminRouter.get('/outlets/products/:productId/recipe', restrictToSuperAdminOrAdmin, getProductRecipe);
superadminRouter.post('/outlets/products/:productId/recipe', restrictToSuperAdminOrAdmin, saveProductRecipe);
superadminRouter.delete('/outlets/products/recipe/:recipeId', restrictToSuperAdminOrAdmin, deleteRecipeRow);

//Expense Management
superadminRouter.post('/outlets/add-expenses/', restrictToSuperAdminOrAdmin, uploadBillImage, addExpense);
superadminRouter.get('/outlets/get-expenses/:outletId/', restrictToSuperAdminOrAdmin, getExpenses);
superadminRouter.post('/outlets/get-expense-by-date/', restrictToSuperAdminOrAdmin, getExpenseByDate);
// Expense Masters
superadminRouter.get('/outlets/expense-categories/:outletId', restrictToSuperAdminOrAdmin, getExpenseCategories);
superadminRouter.post('/outlets/expense-categories/', restrictToSuperAdminOrAdmin, createExpenseCategory);
superadminRouter.delete('/outlets/expense-categories/:id', restrictToSuperAdminOrAdmin, deleteExpenseCategory);
superadminRouter.get('/outlets/expense-names/:outletId', restrictToSuperAdminOrAdmin, getExpenseNames);
superadminRouter.post('/outlets/expense-names/', restrictToSuperAdminOrAdmin, createExpenseName);
superadminRouter.delete('/outlets/expense-names/:id', restrictToSuperAdminOrAdmin, deleteExpenseName);
superadminRouter.get('/outlets/vendors/:outletId', restrictToSuperAdminOrAdmin, getVendors);
superadminRouter.post('/outlets/vendors/', restrictToSuperAdminOrAdmin, createVendor);
superadminRouter.delete('/outlets/vendors/:id', restrictToSuperAdminOrAdmin, deleteVendor);

//Wallet Management
superadminRouter.get('/outlets/wallet-history/:outletId/', restrictToSuperAdminOrAdmin, getCustomersWithWallet);
superadminRouter.get('/outlets/recharge-history/:outletId/', restrictToSuperAdminOrAdmin, getRechargeHistoryByOutlet);
superadminRouter.get('/outlets/paid-wallet/', restrictToSuperAdminOrAdmin, getOrdersPaidViaWallet);

//Customer Management
superadminRouter.get('/outlets/customers/:outletId/', restrictToSuperAdminOrAdmin, getOutletCustomers);

//Ticket Management
superadminRouter.get('/outlets/tickets/:outletId', restrictToSuperAdminOrAdmin, getTickets);
superadminRouter.post('/outlets/ticket-close/', restrictToSuperAdminOrAdmin, ticketClose);

//Coupon Management
superadminRouter.post('/create-coupon/', restrictToSuperAdminOrAdmin, createCoupon);
superadminRouter.get('/get-coupons/:outletId', restrictToSuperAdminOrAdmin, getCoupons);
superadminRouter.delete('/delete-coupon/:couponId/', restrictToSuperAdminOrAdmin, deleteCoupon);

//Notification Management
superadminRouter.get('/dashboard/low-stock-notifications', restrictToSuperAdminOrAdmin, getLowStockNotifications);

// Scheduled Notifications
superadminRouter.post('/notifications/schedule', restrictToSuperAdminOrAdmin, createScheduledNotification);
superadminRouter.get('/notifications/scheduled/:outletId', restrictToSuperAdminOrAdmin, getScheduledNotifications);
superadminRouter.delete('/notifications/scheduled/:notificationId', restrictToSuperAdminOrAdmin, cancelScheduledNotification);
superadminRouter.post('/notifications/send-immediate', restrictToSuperAdminOrAdmin, sendImmediateNotification);
superadminRouter.get('/notifications/stats/:outletId', restrictToSuperAdminOrAdmin, getNotificationStats);

// FCM Test Routes
superadminRouter.get('/notifications/fcm-status', restrictToSuperAdminOrAdmin, testFCMService);
superadminRouter.post('/notifications/test-single', restrictToSuperAdminOrAdmin, testSingleDeviceNotification);

//App management
superadminRouter.get("/outlets/get-non-availability-preview/:outletId", restrictToSuperAdminOrAdmin, getOutletNonAvailabilityPreview);
superadminRouter.post("/outlets/set-availability/", restrictToSuperAdminOrAdmin, setOutletAvailability);
superadminRouter.get("/outlets/get-available-dates/:outletId", restrictToSuperAdminOrAdmin, getAvailableDatesAndSlots);

//Outlet App Feature Management
superadminRouter.get("/outlets/app-features/:outletId", restrictToSuperAdminOrAdminOrCustomer, getOutletAppFeatures);
superadminRouter.post("/outlets/app-features/", restrictToSuperAdminOrAdmin, updateOutletAppFeatures);

//Reports Management
superadminRouter.post('/outlets/sales-report/:outletId/', restrictToSuperAdminOrAdmin, getOutletSalesReport);
superadminRouter.post('/outlets/revenue-report/:outletId/', restrictToSuperAdminOrAdmin, getOutletRevenueByItems);
superadminRouter.post('/outlets/revenue-split/:outletId/', restrictToSuperAdminOrAdmin, getRevenueSplit);
superadminRouter.post('/outlets/wallet-recharge-by-day/:outletId/', restrictToSuperAdminOrAdmin, getWalletRechargeByDay);
superadminRouter.post('/outlets/profit-loss-trends/:outletId/', restrictToSuperAdminOrAdmin, getProfitLossTrends);
superadminRouter.post('/outlets/customer-overview/:outletId/', restrictToSuperAdminOrAdmin, getCustomerOverview);
superadminRouter.post('/outlets/customer-per-order/:outletId/', restrictToSuperAdminOrAdmin, getCustomerPerOrder);

// Dashboard Management
superadminRouter.get('/dashboard/overview', restrictToSuperAdminOrAdmin, getDashboardOverview);
superadminRouter.post('/dashboard/revenue-trend', restrictToSuperAdminOrAdmin, getRevenueTrend);
superadminRouter.post('/dashboard/order-status-distribution', restrictToSuperAdminOrAdmin, getOrderStatusDistribution);
superadminRouter.post('/dashboard/order-source-distribution', restrictToSuperAdminOrAdmin, getOrderSourceDistribution);
superadminRouter.post('/dashboard/top-selling-items', restrictToSuperAdminOrAdmin, getTopSellingItems);
superadminRouter.post('/dashboard/peak-time-slots', restrictToSuperAdminOrAdmin, getPeakTimeSlots);

// Superadmin: Pending admin verifications
superadminRouter.get('/pending-admins', restrictToSuperAdmin, getPendingAdminVerifications);
superadminRouter.post('/verify-admin/:adminId', restrictToSuperAdmin, verifyAdmin);
superadminRouter.get('/verified-admins', restrictToSuperAdmin, getVerifiedAdmins);
superadminRouter.get('/admin/:adminId', restrictToSuperAdminOrAdmin, getAdminDetails);
superadminRouter.delete('/admin/:adminId', restrictToSuperAdmin, deleteAdmin);

// Superadmin: Pending staff verifications
superadminRouter.post('/verify-staff/:userId', restrictToSuperAdmin, verifyStaff);
superadminRouter.get('/unverified-staff', restrictToSuperAdmin, getUnverifiedStaff);
superadminRouter.get('/verified-staff', restrictToSuperAdmin, getVerifiedStaff);


//Permssion and outletid assigning
superadminRouter.post('/map-outlets-to-admin', restrictToSuperAdmin, mapOutletsToAdmin);
superadminRouter.post('/assign-admin-permissions', restrictToSuperAdmin, assignAdminPermissions);

//Coupon Management 
superadminRouter.post('/create-coupons', restrictToSuperAdmin,createCoupon);


export default superadminRouter;
