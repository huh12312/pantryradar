import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHouseSchema, updateHouseSchema } from "@pantrymaid/shared/schemas";
import { authMiddleware, getUser } from "../middleware/auth";
import { db } from "../lib/db";
import { houses as housesTable } from "../db/schema";
import { eq, and, count } from "drizzle-orm";

const houses = new Hono();

houses.use("*", authMiddleware);

/**
 * GET /houses — list all houses for the authenticated user's household
 */
houses.get("/", async (c) => {
  const user = getUser(c);
  if (!user.householdId) return c.json({ success: true, data: [] });

  const list = await db
    .select()
    .from(housesTable)
    .where(eq(housesTable.householdId, user.householdId))
    .orderBy(housesTable.createdAt);

  return c.json({ success: true, data: list });
});

/**
 * POST /houses — create a new house within the user's household
 */
houses.post("/", zValidator("json", createHouseSchema), async (c) => {
  const user = getUser(c);
  if (!user.householdId) {
    return c.json({ success: false, error: "User must belong to a household" }, 403);
  }

  const { name } = c.req.valid("json");
  const [created] = await db
    .insert(housesTable)
    .values({ householdId: user.householdId, name: name.trim() })
    .returning();

  return c.json({ success: true, data: created }, 201);
});

/**
 * PATCH /houses/:id — rename a house (household-scoped IDOR protection)
 */
houses.patch("/:id", zValidator("json", updateHouseSchema), async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  if (!user.householdId) return c.json({ success: false, error: "Forbidden" }, 403);

  const { name } = c.req.valid("json");
  const [updated] = await db
    .update(housesTable)
    .set({ name: name.trim() })
    .where(and(eq(housesTable.id, id), eq(housesTable.householdId, user.householdId)))
    .returning();

  if (!updated) return c.json({ success: false, error: "House not found" }, 404);
  return c.json({ success: true, data: updated });
});

/**
 * DELETE /houses/:id — delete a house (only if the household has more than one)
 */
houses.delete("/:id", async (c) => {
  const user = getUser(c);
  const id = c.req.param("id");
  if (!user.householdId) return c.json({ success: false, error: "Forbidden" }, 403);

  // Prevent deleting the last house
  const [countRow] = await db
    .select({ total: count() })
    .from(housesTable)
    .where(eq(housesTable.householdId, user.householdId));

  if (Number(countRow?.total ?? 0) <= 1) {
    return c.json({ success: false, error: "Cannot delete the last house" }, 400);
  }

  const result = await db
    .delete(housesTable)
    .where(and(eq(housesTable.id, id), eq(housesTable.householdId, user.householdId)))
    .returning();

  if (result.length === 0) return c.json({ success: false, error: "House not found" }, 404);
  return c.json({ success: true, data: null });
});

export default houses;
