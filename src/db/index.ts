import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  if (typeof window === "undefined" && process.env.NODE_ENV === "production" && process.env.NEXT_RUNTIME) {
    throw new Error(
      "DATABASE_URL environment variable is required. Connect to live Neon PostgreSQL instance.",
    );
  }
}

const sql = neon(databaseUrl || "postgresql://unconfigured@localhost:5432/neondb");

export const db = drizzle(sql, { schema });
export { schema };
