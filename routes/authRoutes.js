import express from 'express';
import {
  adminSignIn,
  customerSignIn,
  signOut,
  checkAuth,
  staffSignIn,
  superAdminSignIn,
  adminSignup,
  staffSignup,
  customerSignup,
} from '../controllers/auth/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { uploadDocuments } from '../middlewares/upload.middleware.js';
import { requestPasswordReset, verifyResetOtp, resetPassword } from '../controllers/auth/passwordReset.controller.js';

const authRouter = express.Router();

// Public routes

//Customer auth
authRouter.post('/signup', customerSignup);
authRouter.post('/signin', customerSignIn);

// Password Reset endpoints
authRouter.post('/forgot-password', requestPasswordReset);
authRouter.post('/verify-reset-otp', verifyResetOtp);
authRouter.post('/reset-password', resetPassword);

//staff auth
authRouter.post('/staff-signup', uploadDocuments, staffSignup)
authRouter.post('/staff-signin', staffSignIn);

//admin auth
authRouter.post('/admin-signup', uploadDocuments, adminSignup);
authRouter.post('/admin-signin', adminSignIn);

//super-admin auth
authRouter.post('/superadmin-signin', superAdminSignIn);

// Protected route
authRouter.get('/me', authenticateToken, checkAuth);

//sign out
authRouter.post('/signout', signOut);

export default authRouter;