import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../prisma/client.js';
import { JWT_SECRET, JWT_EXPIRES_IN, isSecureCookie } from '../../config/env.js';
import { uploadDocuments, uploadFilesToS3 } from '../../middlewares/upload.middleware.js';



export const customerSignup = async (req, res, next) => {
  const { name, email, password, retypePassword, outletId, phone, yearOfStudy } = req.body;

  try {
    if (!name || !email || !password || !retypePassword || !outletId || !phone) {
      return res.status(400).json({ message: 'Name, email, password, retype password, outlet ID, and phone are required' });
    }

    if (password !== retypePassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CUSTOMER',
        phone,
        outletId,
        customerInfo: {
          create: {
            yearOfStudy: yearOfStudy ? parseInt(yearOfStudy, 10) : null,
            wallet: {
              create: {
                balance: 0,
                totalRecharged: 0,
                totalUsed: 0,
              },
            },
            cart: {
              create: {}, // Initialize empty cart
            },
          },
        },
      },
      include: {
        customerInfo: { include: { wallet: true, cart: true } },
        outlet: true,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, outletId: user.outletId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      outletId: user.outletId,
      outlet: user.outlet,
      customerDetails: user.customerInfo ? {
        id: user.customerInfo.id,
        yearOfStudy: user.customerInfo.yearOfStudy,
        wallet: user.customerInfo.wallet,
        cart: user.customerInfo.cart,
      } : undefined,
    };

    res.status(201).json({ message: 'Customer created successfully', user: response });
  } catch (error) {
    console.error('Customer signup error:', error);
    next(error);
  }
};

export const adminSignup = async (req, res, next) => {
  const { name, email, password, retypePassword, phone } = req.body;

  try {
    if (!name || !email || !password || !retypePassword) {
      return res.status(400).json({ message: 'Name, email, password, and retype password are required' });
    }

    if (password !== retypePassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Upload documents to S3 if provided
    let aadharUrl = null;
    let panUrl = null;
    
    if (req.files) {
      const uploadedUrls = await uploadFilesToS3(req.files);
      aadharUrl = uploadedUrls.aadharUrl;
      panUrl = uploadedUrls.panUrl;
    }

    const admin = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isVerified: false,
        phone,
        aadharUrl,
        panUrl
      },
    });

    console.log(`Admin signup request for ${email}. Awaiting SuperAdmin verification.`);

    res.status(201).json({ 
      message: 'Admin signup successful. Awaiting SuperAdmin verification.', 
      adminId: admin.id,
      documentsUploaded: {
        aadhar: !!aadharUrl,
        pan: !!panUrl
      }
    });
  } catch (error) {
    console.error('Admin signup error:', error);
    next(error);
  }
};

export const staffSignup = async (req, res, next) => {
  const { name, email, password, retypePassword, phone } = req.body;

  try {
    if (!name || !email || !password || !retypePassword) {
      return res.status(400).json({ message: 'Name, email, password, and retype password are required' });
    }

    if (password !== retypePassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Upload documents to S3 if provided
    let aadharUrl = null;
    let panUrl = null;
    
    if (req.files) {
      const uploadedUrls = await uploadFilesToS3(req.files);
      aadharUrl = uploadedUrls.aadharUrl;
      panUrl = uploadedUrls.panUrl;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'STAFF',
        phone: phone || null,
        outletId: null,
        isVerified: false,
        staffInfo: {
          create: {
            staffRole: "Staff",
            aadharUrl,
            panUrl
          }
        }
      },
      include: {
        outlet: true,
        staffInfo: { include: { permissions: true } },
      },
    });

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      outletId: user.outletId,
      outlet: user.outlet,
      isVerified: user.isVerified,
      staffDetails: user.staffInfo ? {
        id: user.staffInfo.id,
        staffRole: user.staffInfo.staffRole,
        aadharUrl: user.staffInfo.aadharUrl,
        panUrl: user.staffInfo.panUrl,
        permissions: user.staffInfo.permissions,
      } : null, 
    };

    console.log(`Staff signup request for ${email}. Awaiting SuperAdmin verification.`);

    res.status(201).json({ 
      message: 'Staff signup successful. Awaiting SuperAdmin verification.', 
      user: response,
      documentsUploaded: {
        aadhar: !!aadharUrl,
        pan: !!panUrl
      }
    });
  } catch (error) {
    console.error('Staff signup error:', error);
    next(error);
  }
};

export const superAdminSignIn = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { outlet: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Access denied. Only SuperAdmin can log in here.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, outletId: user.outletId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      outletId: user.outletId,
      outlet: user.outlet,
    };

    // Return token in response body as well
    res.status(200).json({ 
      message: 'SuperAdmin login successful', 
      user: response,
      token: token 
    });
  } catch (error) {
    console.error('SuperAdmin login error:', error);
    next(error);
  }
};


export const verifyAdmin = async (req, res, next) => {
  const { adminId, outletIds, permissions } = req.body;
  const userId = req.user.id;

  try {
    // Verify the requesting user is SuperAdmin
    const superAdmin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!superAdmin || superAdmin.role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Only SuperAdmin can verify admins' });
    }

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.isVerified) {
      return res.status(400).json({ message: 'Admin is already verified' });
    }

    // Update admin to verified status and assign outlets and permissions
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        isVerified: true,
        outlets: {
          createMany: {
            data: outletIds.map(outletId => ({ outletId })),
          },
        },
        permissions: {
          createMany: {
            data: permissions.map(p => ({
              adminOutletId: p.adminOutletId,
              type: p.type,
              isGranted: true,
            })),
          },
        },
      },
    });

    res.status(200).json({ message: 'Admin verified successfully' });
  } catch (error) {
    console.error('Admin verification error:', error);
    next(error);
  }
};

export const adminSignIn = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: {
        outlets: {
          include: {
            outlet: true,
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!admin.isVerified) {
      return res.status(403).json({ message: 'Admin not verified. Contact SuperAdmin.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const response = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'ADMIN',
      isVerified: admin.isVerified,
      outlets: admin.outlets.map(outlet => ({
        outletId: outlet.outletId,
        outlet: outlet.outlet,
        permissions: outlet.permissions,
      })),
    };

    // Return token in response body as well
    res.status(200).json({ 
      message: 'Admin login successful', 
      admin: response,
      token: token 
    });
  } catch (error) {
    console.error('Admin login error:', error);
    next(error);
  }
};

export const customerSignIn = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerInfo: { include: { wallet: true, cart: true } },
        outlet: true,
      },
    });

    if (!user || user.role !== 'CUSTOMER') {
      return res.status(401).json({ message: 'Invalid customer credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, outletId: user.outletId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      outletId: user.outletId,
      outlet: user.outlet,
      customerDetails: user.customerInfo ? {
        id: user.customerInfo.id,
        yearOfStudy: user.customerInfo.yearOfStudy,
        wallet: user.customerInfo.wallet,
        cart: user.customerInfo.cart,
      } : undefined,
    };

    res.status(200).json({ message: 'Customer login successful', user: response });
  } catch (error) {
    console.error('Customer login error:', error);
    next(error);
  }
};

export const staffSignIn = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        staffInfo: { include: { permissions: true } },
        outlet: true,
      },
    });

    if (!user || user.role !== 'STAFF') {
      return res.status(401).json({ message: 'Invalid staff credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Staff not verified. Contact SuperAdmin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid staff credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, outletId: user.outletId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const response = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      outletId: user.outletId,
      outlet: user.outlet,
      staffDetails: user.staffInfo ? {
        id: user.staffInfo.id,
        staffRole: user.staffInfo.staffRole,
        permissions: user.staffInfo.permissions,
      } : undefined,
    };

    // Return token in response body as well
    res.status(200).json({ 
      message: 'Staff login successful', 
      user: response,
      token: token 
    });
  } catch (error) {
    console.error('Staff login error:', error);
    next(error);
  }
};


export const signOut = async (req, res, next) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
    });
    res.status(200).json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Sign out error:', error);
    next(error);
  }
};

export const checkAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('JWT verification failed:', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

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
              permissions: true
            }
          }
        }
      });

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      if (!admin.isVerified) {
        return res.status(403).json({ message: 'Admin not verified' });
      }

      const response = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'ADMIN',
        isVerified: admin.isVerified,
        outlets: admin.outlets
      };

      return res.status(200).json({ user: response });
    } else {

      const userId = Number(decoded.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid token payload' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          customerInfo: { include: { wallet: true, cart: true } },
          staffInfo: { include: { permissions: true } },
          outlet: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const response = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        outletId: user.outletId,
        outlet: user.outlet,
        customerDetails: user.customerInfo ? {
          id: user.customerInfo.id,
          yearOfStudy: user.customerInfo.yearOfStudy,
          wallet: user.customerInfo.wallet,
          cart: user.customerInfo.cart,
        } : undefined,
        staffDetails: user.staffInfo ? {
          id: user.staffInfo.id,
          staffRole: user.staffInfo.staffRole,
          permissions: user.staffInfo.permissions,
        } : undefined,
      };

      return res.status(200).json({ user: response });
    }
  } catch (error) {
    console.error('Check auth error:', error);
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};
