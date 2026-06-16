import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import prisma from '../prisma/client.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role === 'ADMIN') {
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          isVerified: true,
          outlets: {
            include: {
              outlet: true,
              permissions: true,
            },
          },
        },
      });

      if (!admin) {
        return res.status(401).json({ message: 'Invalid token. Admin not found.' });
      }
      if (!admin.isVerified) {
        return res.status(403).json({ message: 'Admin not verified.' });
      }
      req.admin = admin;
      req.user = { ...admin, role: 'ADMIN' }; // Attach to req.user for role-based checks
    } else {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          outletId: true,
          phone: true,
          isVerified: true,
          customerInfo: { include: { wallet: true, cart: true } },
          staffInfo: { include: { permissions: true } },
          outlet: true,
        },
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid token. User not found.' });
      }
      if (user.role === 'STAFF' && !user.isVerified) {
        return res.status(403).json({ message: 'Staff not verified.' });
      }
      req.user = user;
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(500).json({ 
      message: 'Server error during authentication.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

export const restrictToSuperAdmin = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('SUPERADMIN')(req, res, next);
  });
};

export const restrictToSuperAdminOrAdmin = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('SUPERADMIN', 'ADMIN')(req, res, next);
  });
};

export const restrictToSuperAdminOrAdminOrCustomer = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('SUPERADMIN', 'ADMIN','CUSTOMER')(req, res, next);
  });
};

export const restrictToStaff = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('STAFF')(req, res, next);
  });
};

export const restrictToCustomer = (req, res, next) => {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    authorizeRoles('CUSTOMER')(req, res, next);
  });
};

export const restrictToStaffWithPermission = (permissionType) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN') {
    return next();
  }
  if (req.user.role !== 'STAFF') {
    return res.status(403).json({ message: 'Unauthorized: Must be STAFF, ADMIN, or SUPERADMIN.' });
  }
  try {
    const staff = await prisma.staffDetails.findUnique({
      where: { userId: req.user.id },
      include: {
        permissions: {
          where: { type: permissionType, isGranted: true },
        },
      },
    });
    if (!staff || staff.permissions.length === 0) {
      return res.status(403).json({ message: `Unauthorized: ${permissionType} permission required.` });
    }
    next();
  } catch (error) {
    console.error('Error checking staff permission:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const authenticate = authenticateToken;
export const authorize = authorizeRoles;
