// app.js
import dotenv from 'dotenv';
dotenv.config();
import pool from './db/db.js';
import express from "express";
const app = express();
const PORT = process.env.PORT || 5500;

import authRoutes from './routes/authRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import errorMiddleware from './middlewares/error.middleware.js';
import arjectMiddleware from './middlewares/arcjet.middleware.js';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import staffRoutes from './routes/staffRoutes.js';
import customerRouter from './routes/customerRoutes.js';
import multer from "multer";
import './services/notificationScheduler.js'; // Initialize notification scheduler
import './services/orderCancellationScheduler.js'; // Initialize order cancellation scheduler

app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';

// Define allowed origins - remove trailing slashes
const defaultProductionOrigins = [
  'http://admins.mrkadalai.com.s3-website.ap-south-1.amazonaws.com',
  'http://staffs.mrkadalai.com.s3-website.ap-south-1.amazonaws.com',
  'http://localhost:3000', // For local testing
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://mrkadalai-staff.vercel.app',
  'https://mrkadalai-frontend.vercel.app'
];

const allowedOriginsList = isProduction
  ? (process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : defaultProductionOrigins)
  : true; // Allow all in development

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (isProduction) {
      // Check if origin is in allowed list
      if (allowedOriginsList.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        console.log(`Allowed origins: ${JSON.stringify(allowedOriginsList, null, 2)}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable Arcjet in production
if (isProduction) {
  app.use(arjectMiddleware);
}

app.use('/api/superadmin', superAdminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customer', customerRouter);
app.use(errorMiddleware);

app.get('/', (req, res) => {
  res.send('MrKadalai Backend Server is running...');
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Server listening on http://localhost:${PORT}`);
  if (isProduction) {
    console.log(`🌐 External access: http://${process.env.EC2_PUBLIC_IP || 'your-ec2-ip'}:${PORT}`);
  }
  await pool;
});
