import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHouseholdSchema } from "@pantrymaid/shared/schemas";
import { authMiddleware, getUser } from "../middleware/auth";
import { db } from "../lib/db";
import { households as householdsTable, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const households = new Hono();

// All household routes require authentication
households.use("*", authMiddleware);

/**
 * Generate a cryptographically secure random invite code
 * Uses Node.js crypto.randomBytes for unpredictability
 */
function generateInviteCode(): string {
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
 * POST /households - Create a new household
 */
households.post(
  "/",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  zValidator("json", createHouseholdSchema),
  async (c) => {
    try {
      const user = getUser(c);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = c.req.valid("json");

      // Check if user already has a household
      if (user.householdId) {
        return c.json(
          {
            success: false,
            error: "User already belongs to a household",
          },
          400
        );
      }

      const inviteCode = generateInviteCode();

      const [household] = await db.insert(householdsTable).values({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        name: data.name,
        inviteCode,
      }).returning();

      // Create user profile entry if it doesn't exist, or update household association
      await db.insert(users).values({
        id: user.id,
        householdId: household!.id,
        displayName: user.email,
      }).onConflictDoUpdate({
        target: users.id,
        set: { householdId: household!.id },
      });

      return c.json({
        success: true,
        data: household,
      }, 201);
    } catch (error) {
      console.error("Error creating household:", error);
      return c.json(
        {
          success: false,
          error: "Failed to create household",
        },
        500
      );
    }
  }
);

/**
 * GET /households/:id - Get household details (with members)
 */
households.get("/:id", async (c) => {
  try {
    const user = getUser(c);
    const householdId = c.req.param("id");

    // IDOR prevention: User can only access their own household
    if (user.householdId !== householdId) {
      return c.json(
        {
          success: false,
          error: "Access denied - not a member of this household",
        },
        403
      );
    }

    const [household] = await db.select().from(householdsTable)
      .where(eq(householdsTable.id, householdId));

    if (!household) {
      return c.json({ success: false, error: "Household not found" }, 404);
    }

    // Get household members
    const members = await db.select({
      id: users.id,
      displayName: users.displayName,
      createdAt: users.createdAt,
    }).from(users)
      .where(eq(users.householdId, householdId));

    return c.json({
      success: true,
      data: {
        ...household,
        members,
      },
    });
  } catch (error) {
    console.error("Error fetching household:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch household",
      },
      500
    );
  }
});

/**
 * POST /households/:id/members - Invite user to household via invite code
 */
households.post(
  "/:id/members",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  zValidator("json", z.object({
    inviteCode: z.string().min(8).max(8),
  })),
  async (c) => {
    try {
      const user = getUser(c);
      const householdId = c.req.param("id");
      const { inviteCode } = c.req.valid("json");

      // Check if user already has a household
      if (user.householdId) {
        return c.json(
          {
            success: false,
            error: "User already belongs to a household",
          },
          400
        );
      }

      // Verify invite code matches household
      const [household] = await db.select().from(householdsTable)
        .where(and(
          eq(householdsTable.id, householdId),
          eq(householdsTable.inviteCode, inviteCode)
        ));

      if (!household) {
        return c.json({ success: false, error: "Invalid invite code" }, 400);
      }

      // Create user profile entry if it doesn't exist, or update household association
      await db.insert(users).values({
        id: user.id,
        householdId,
        displayName: user.email,
      }).onConflictDoUpdate({
        target: users.id,
        set: { householdId },
      });

      return c.json({
        success: true,
        data: household,
      });
    } catch (error) {
      console.error("Error joining household:", error);
      return c.json(
        {
          success: false,
          error: "Failed to join household",
        },
        500
      );
    }
  }
);

export default households;
