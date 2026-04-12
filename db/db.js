import { Pool } from "pg";
import dotenv from 'dotenv';
import { DB_URI } from "../config/env.js";
import fs from 'fs';
import path from 'path';

dotenv.config();

if (!DB_URI) {
  throw new Error("Missing DATABASE_URL in environment");
}

// SSL: RDS requires encrypted connections (even via SSH tunnel).
// rejectUnauthorized:false skips cert validation — tunneled locally, safe to do.
const pool = new Pool({
  connectionString: DB_URI,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 50000,
});

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client:", err.message);
  // Don't crash on idle client errors
});

pool
  .connect()
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("DB connection error:", err.message));

export default pool;
