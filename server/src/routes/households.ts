import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHouseholdSchema, updateHouseholdSettingsSchema } from "@pantrymaid/shared/schemas";
import type {
  CreateHouseholdInput,
  UpdateHouseholdSettingsInput,
} from "@pantrymaid/shared/schemas";
import { authMiddleware, getUser } from "../middleware/auth";
import { db } from "../lib/db";
import { households as householdsTable, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateInviteCode } from "../lib/auth";

const households = new Hono();

// All household routes require authentication
households.use("*", authMiddleware);

/**
 * POST /households - Create a new household
 */
households.post("/", zValidator("json", createHouseholdSchema), async (c) => {
  try {
    const user = getUser(c);
    const data = c.req.valid("json") as CreateHouseholdInput;

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

    const [household] = await db
      .insert(householdsTable)
      .values({
        name: data.name,
        inviteCode,
      })
      .returning();

    // Create user profile entry if it doesn't exist, or update household association
    await db
      .insert(users)
      .values({
        id: user.id,
        householdId: household!.id,
        displayName: user.email,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { householdId: household!.id },
      });

    return c.json(
      {
        success: true,
        data: household,
      },
      201
    );
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
});

/**
 * GET /households/me - Get the authenticated user's household
 */
households.get("/me", async (c) => {
  try {
    const user = getUser(c);

    if (!user.householdId) {
      return c.json(
        {
          success: false,
          error: "User does not belong to a household",
        },
        404
      );
    }

    const [household] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, user.householdId));

    if (!household) {
      return c.json({ success: false, error: "Household not found" }, 404);
    }

    const members = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.householdId, user.householdId));

    return c.json({
      success: true,
      data: {
        id: household.id,
        name: household.name,
        inviteCode: household.inviteCode,
        createdAt: household.createdAt,
        krogerLocationId: household.krogerLocationId,
        krogerStoreName: household.krogerStoreName,
        krogerChain: household.krogerChain,
        krogerZipCode: household.krogerZipCode,
        members,
      },
    });
  } catch (error) {
    console.error("Error fetching user's household:", error);
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
 * POST /households/join - Join a household using only an invite code
 */
households.post(
  "/join",
  zValidator(
    "json",
    z.object({
      inviteCode: z.string().min(8).max(8),
    })
  ),
  async (c) => {
    try {
      const user = getUser(c);
      const { inviteCode } = c.req.valid("json");

      if (user.householdId) {
        return c.json(
          {
            success: false,
            error: "User already belongs to a household",
          },
          400
        );
      }

      // Look up household by invite code alone
      const [household] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.inviteCode, inviteCode));

      if (!household) {
        return c.json({ success: false, error: "Invalid invite code" }, 400);
      }

      await db
        .insert(users)
        .values({
          id: user.id,
          householdId: household.id,
          displayName: user.email,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { householdId: household.id },
        });

      return c.json({
        success: true,
        data: household,
      });
    } catch (error) {
      console.error("Error joining household via invite code:", error);
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

/**
 * POST /households/leave-and-join - Leave current household and join another via invite code.
 * Deletes the old household entirely if the user was the last member (cascade wipes all items
 * and shopping list entries). If other members remain, the user is simply removed.
 */
households.post(
  "/leave-and-join",
  zValidator("json", z.object({ inviteCode: z.string().min(8).max(8) })),
  async (c) => {
    try {
      const user = getUser(c);
      const { inviteCode } = c.req.valid("json");

      if (!user.householdId) {
        return c.json({ success: false, error: "You do not currently belong to a household" }, 400);
      }

      // Resolve target household
      const [target] = await db
        .select()
        .from(householdsTable)
        .where(eq(householdsTable.inviteCode, inviteCode.toUpperCase()));

      if (!target) {
        return c.json({ success: false, error: "Invalid invite code" }, 400);
      }

      if (target.id === user.householdId) {
        return c.json({ success: false, error: "You are already in this household" }, 400);
      }

      // Count remaining members of the old household after removing this user
      const remaining = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.householdId, user.householdId));

      if (remaining.length <= 1) {
        // User was the sole member — delete the household (cascade removes all items + shopping list)
        await db.delete(householdsTable).where(eq(householdsTable.id, user.householdId));
      }
      // (If other members exist, the household and their data remain; the user is simply reassigned below)

      // Move user to the new household
      await db.update(users).set({ householdId: target.id }).where(eq(users.id, user.id));

      return c.json({
        success: true,
        data: { householdId: target.id, householdName: target.name },
      });
    } catch (error) {
      console.error("Error in leave-and-join:", error);
      return c.json({ success: false, error: "Failed to switch households" }, 500);
    }
  }
);

/**
 * PATCH /households/me/settings - Update household store preferences (Kroger location)
 */
households.patch("/me/settings", zValidator("json", updateHouseholdSettingsSchema), async (c) => {
  try {
    const user = getUser(c);
    const data = c.req.valid("json") as UpdateHouseholdSettingsInput;

    if (!user.householdId) {
      return c.json({ success: false, error: "User does not belong to a household" }, 404);
    }

    const [updated] = await db
      .update(householdsTable)
      .set({
        krogerLocationId: data.krogerLocationId ?? null,
        krogerStoreName: data.krogerStoreName ?? null,
        krogerChain: data.krogerChain ?? null,
        krogerZipCode: data.krogerZipCode ?? null,
      })
      .where(eq(householdsTable.id, user.householdId))
      .returning();

    if (!updated) {
      return c.json({ success: false, error: "Household not found" }, 404);
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating household settings:", error);
    return c.json({ success: false, error: "Failed to update household settings" }, 500);
  }
});

export default households;
