import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // SSL disabled by default — enable via DB_SSL=true for hosted databases
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
});

// Create drizzle instance with schema for Better Auth integration
export const db = drizzle(client, { schema });

// Export client for direct queries if needed
export { client };
