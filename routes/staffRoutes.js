import express  from'express';
import { authenticateToken,authorizeRoles, restrictToStaff } from '../middlewares/auth.middleware.js';
import { addManualOrder,getProducts } from '../controllers/staff/manualOrder.controller.js';
import { getHomeDetails, getOrder, getTicketsCount, recentOrders, updateOrder } from '../controllers/staff/home.controller.js';
import { getStocks,addStock,deductStock,stockHistory } from '../controllers/staff/inventory.controller.js';
import { getRechargeHistory,addRecharge } from '../controllers/staff/wallet.controller.js';
import { OutletCurrentOrder } from '../controllers/staff/notification.controller.js';
import { getAvailableDatesAndSlotsForStaff, getOrderHistory } from '../controllers/staff/orderHistory.controller.js';
import { getStaffProfile, updateStaffProfile, uploadStaffImage, deleteStaffImage, upload } from '../controllers/staff/profile.controller.js';
import { changePassword, generate2FASetup, enable2FA, disable2FA, get2FAStatus, verify2FAToken, getBackupCodesCount } from '../controllers/staff/security.controller.js';
import { 
    getSalesTrend,
    getOrderTypeBreakdown, 
    getNewCustomersTrend,
    getCategoryBreakdown,
    getDeliveryTimeOrders,
    getCancellationRefunds,
    getQuantitySold
} from '../controllers/staff/reports.controller.js';

const staffRouter = express.Router();

staffRouter.use(restrictToStaff)


//Home management
staffRouter.get('/outlets/get-home-data/',authenticateToken,authorizeRoles('STAFF'),getHomeDetails);
staffRouter.get('/outlets/get-recent-orders/:outletId/',authenticateToken,authorizeRoles('STAFF'),recentOrders);
staffRouter.get('/outlets/get-order/:outletId/:orderId/',authenticateToken,authorizeRoles('STAFF'),getOrder);
staffRouter.put('/outlets/update-order/',authenticateToken,authorizeRoles('STAFF'),updateOrder);
staffRouter.get('outlets/tickets/count',authenticateToken,authorizeRoles('STAFF'),getTicketsCount);

//Manual Order
staffRouter.post('/outlets/add-manual-order/',authenticateToken,authorizeRoles('STAFF'),addManualOrder);
staffRouter.get('/outlets/get-products-in-stock/:outletId',authenticateToken,authorizeRoles('STAFF'),getProducts);

//Inventory Management (New InventoryItem system)
staffRouter.get('/outlets/get-stocks/:outletId/',authenticateToken,authorizeRoles('STAFF'),getStocks);
staffRouter.post('/outlets/add-stock/',authenticateToken,authorizeRoles('STAFF'),addStock);
staffRouter.post('/outlets/deduct-stock/',authenticateToken,authorizeRoles('STAFF'),deductStock);
staffRouter.post('/outlets/get-stock-history',authenticateToken,authorizeRoles('STAFF'),stockHistory);

//Notification Management
staffRouter.get('/outlets/get-current-order/:outletId',authenticateToken,authorizeRoles('STAFF'),OutletCurrentOrder)

//Recharge Management

staffRouter.get('/outlets/get-recharge-history/:outletId/',authenticateToken,authorizeRoles('STAFF'),getRechargeHistory);
staffRouter.post('/outlets/recharge-wallet/',authenticateToken,authorizeRoles('STAFF'),addRecharge);

//Order management
staffRouter.get('/outlets/get-order-history/',authenticateToken,authorizeRoles('STAFF'),getOrderHistory);
staffRouter.get('/outlets/get-orderdates/:outletId/',authenticateToken,authorizeRoles('STAFF'),getAvailableDatesAndSlotsForStaff);

// Reports Management
staffRouter.post('/outlets/sales-trend/:outletId/', authenticateToken, authorizeRoles('STAFF'), getSalesTrend);
staffRouter.post('/outlets/order-type-breakdown/:outletId/', authenticateToken, authorizeRoles('STAFF'), getOrderTypeBreakdown);
staffRouter.post('/outlets/new-customers-trend/:outletId/', authenticateToken, authorizeRoles('STAFF'), getNewCustomersTrend);
staffRouter.post('/outlets/category-breakdown/:outletId/', authenticateToken, authorizeRoles('STAFF'), getCategoryBreakdown);
staffRouter.post('/outlets/delivery-time-orders/:outletId/', authenticateToken, authorizeRoles('STAFF'), getDeliveryTimeOrders);
staffRouter.post('/outlets/cancellation-refunds/:outletId/', authenticateToken, authorizeRoles('STAFF'), getCancellationRefunds);
staffRouter.post('/outlets/quantity-sold/:outletId/', authenticateToken, authorizeRoles('STAFF'), getQuantitySold);

//Profile Management
staffRouter.get('/profile/', authenticateToken, authorizeRoles('STAFF'), getStaffProfile);
staffRouter.put('/profile/', authenticateToken, authorizeRoles('STAFF'), upload, updateStaffProfile);
staffRouter.post('/profile/upload-image/', authenticateToken, authorizeRoles('STAFF'), upload, uploadStaffImage);
staffRouter.delete('/profile/delete-image/', authenticateToken, authorizeRoles('STAFF'), deleteStaffImage);

//Security Management
staffRouter.post('/security/change-password/', authenticateToken, authorizeRoles('STAFF'), changePassword);
staffRouter.get('/security/2fa-status/', authenticateToken, authorizeRoles('STAFF'), get2FAStatus);
staffRouter.post('/security/generate-2fa/', authenticateToken, authorizeRoles('STAFF'), generate2FASetup);
staffRouter.post('/security/enable-2fa/', authenticateToken, authorizeRoles('STAFF'), enable2FA);
staffRouter.post('/security/disable-2fa/', authenticateToken, authorizeRoles('STAFF'), disable2FA);
staffRouter.get('/security/backup-codes-count/', authenticateToken, authorizeRoles('STAFF'), getBackupCodesCount);
staffRouter.post('/security/verify-2fa/', verify2FAToken); // No auth needed for login verification

export default staffRouter;