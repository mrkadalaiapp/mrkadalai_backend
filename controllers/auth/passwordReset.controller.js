import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import dns from 'dns';

const dnsPromises = dns.promises;
const prisma = new PrismaClient();

let cachedIPv4Host = null;

dns.setDefaultResultOrder('ipv4first');

// Configure the Gmail transporter
if (!cachedIPv4Host) {
  const addresses = await dnsPromises.resolve4('smtp.gmail.com');
  cachedIPv4Host = addresses[0];
  console.log('[SMTP] Resolved smtp.gmail.com to IPv4:', cachedIPv4Host);
}

const transporter = nodemailer.createTransport({
  host: cachedIPv4Host,
  port: 465,
  secure: true,
  tls: { servername: 'smtp.gmail.com' },
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('[SMTP] Connection failed:', error);
  } else {
    console.log('[SMTP] Server is ready to accept messages');
  }
});

// Helper to generate a 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`[PasswordReset] Request for non-existent email: ${email}`);
      // Return 200 anyway for security (prevent email enumeration)
      return res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
    }

    // Generate numeric OTP and set expiration to 10 minutes
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save to database
    await prisma.passwordReset.create({
      data: {
        email,
        otp,
        expiresAt,
      },
    });
    console.log(`[PasswordReset] OTP generated and saved for ${email}: ${otp}`);

    // Send email via Gmail
    const mailOptions = {
      from: `"Mr Kadalai App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Password Reset OTP',
      text: `Your OTP (One Time Password) for resetting your Mr Kadalai Mobile App password is: ${otp}. It will expire in 10 minutes.\n\nIf you did not request this, please safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #333;">Password Reset Verification</h2>
            <p style="color: #555;">You requested to reset the password for your Mr Kadalai account.</p>
            <p style="color: #555;">Here is your verification code:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #EBB22F;">${otp}</span>
            </div>
            <p style="color: #555; font-size: 14px;">This code expires in 10 minutes.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    };

    console.log(`[PasswordReset] Attempting to send email to ${email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[PasswordReset] Email successfully sent to ${email}`);

    res.status(200).json({ message: 'If the email exists, an OTP has been sent.' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: 'Internal server error while processing request' });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find the latest valid OTP for this email
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        email,
        otp,
        expiresAt: {
          gt: new Date(), // Has not expired yet
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Missing required configuration fields' });
    }

    // Final security check: verify the OTP directly during reset 
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        email,
        otp,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Hash the new password properly
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the User in Prisma
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // Invalidate ALL existing reset tokens for this user so they can't be reused
    await prisma.passwordReset.deleteMany({
      where: { email },
    });

    res.status(200).json({ message: 'Password has been successfully reset' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
