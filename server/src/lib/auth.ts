import { betterAuth } from "better-auth";
import { db } from "./db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { households as householdsTable, users, houses as housesTable } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Generate a cryptographically secure random invite code
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

/**
 * Join an existing household by invite code. Returns false if code is invalid.
 */
export async function joinHouseholdByCode(userId: string, inviteCode: string, displayName: string): Promise<boolean> {
  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.inviteCode, inviteCode.toUpperCase()));

  if (!household) return false;

  await db
    .insert(users)
    .values({ id: userId, householdId: household.id, displayName })
    .onConflictDoUpdate({ target: users.id, set: { householdId: household.id, displayName } });

  console.log(`✓ User ${userId} joined household ${household.id} via invite code`);
  return true;
}

/**
 * Create a default household for a new user
 */
export async function createUserHousehold(userId: string, userName: string): Promise<void> {
  try {
    // Create a default household for the new user
    const inviteCode = generateInviteCode();
    const [household] = await db.insert(householdsTable).values({
      name: `${userName}'s Household`,
      inviteCode,
    }).returning();

    if (household) {
      // Create the default "Main House" for this household
      await db.insert(housesTable).values({
        householdId: household.id,
        name: "Main House",
      });

      // Link the user to the household in the application's users table
      await db.insert(users).values({
        id: userId,
        householdId: household.id,
        displayName: userName,
      });

      console.log(`✓ Created household ${household.id} for user ${userId}`);
    }
  } catch (error) {
    console.error("Failed to create household for new user:", error);
    throw error;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["*"],
  secret: process.env.BETTER_AUTH_SECRET,
});

export type AuthSession = typeof auth.$Infer.Session;
