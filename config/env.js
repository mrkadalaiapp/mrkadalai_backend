import { config } from "dotenv";

config({ path: '.env' });

export const {
    PORT,
    NODE_ENV,
    DB_URI,
    DATABASE_URL,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    ARCJET_KEY,
    ARCJET_ENV,
    COOKIE_SECURE,
} = process.env;

export const isSecureCookie = COOKIE_SECURE !== undefined
    ? COOKIE_SECURE === 'true'
    : (NODE_ENV === 'production');