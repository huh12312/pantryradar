import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../db/schema";

let postgresContainer: StartedPostgreSqlContainer;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let testClient: postgres.Sql;

/**
 * Start a test Postgres container and run migrations
 * Call this at the beginning of test suites
 */
export async function setupTestDb() {
  // Start PostgreSQL container
  postgresContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("pantrymaid_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = postgresContainer.getConnectionUri();

  // Create client and drizzle instance
  testClient = postgres(connectionString, { max: 1 });
  testDb = drizzle(testClient, { schema });

  // Run migrations
  await migrate(testDb, { migrationsFolder: "./drizzle" });

  return { db: testDb, connectionString };
}

/**
 * Clean up test database and stop container
 * Call this at the end of test suites
 */
export async function teardownTestDb() {
  if (testClient) {
    await testClient.end();
  }
  if (postgresContainer) {
    await postgresContainer.stop();
  }
}

/**
 * Clear all tables between tests
 */
export async function clearTables() {
  if (!testDb) {
    throw new Error("Test database not initialized. Call setupTestDb() first.");
  }

  // Clear tables in correct order (respecting foreign keys)
  await testDb.delete(schema.items);
  await testDb.delete(schema.users);
  await testDb.delete(schema.households);
  await testDb.delete(schema.productCache);
}

export { testDb, testClient };
