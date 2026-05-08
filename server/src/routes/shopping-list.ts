import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
} from "@pantrymaid/shared/schemas";
import type {
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from "@pantrymaid/shared/schemas";
import { authMiddleware, getUser } from "../middleware/auth";
import { db } from "../lib/db";
import { shoppingListItems } from "../db/schema";
import { eq, and } from "drizzle-orm";

function serializeShoppingListItem(row: typeof shoppingListItems.$inferSelect) {
  return { ...row, suggestedQty: Number(row.suggestedQty) };
}

const shoppingList = new Hono();
shoppingList.use("*", authMiddleware);

// GET /shopping-list — list pending items for household
shoppingList.get("/", async (c) => {
  try {
    const user = getUser(c);
    if (!user.householdId) {
      return c.json({ success: true, data: [] });
    }
    const rows = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.householdId, user.householdId),
          eq(shoppingListItems.status, "pending")
        )
      );
    return c.json({ success: true, data: rows.map(serializeShoppingListItem) });
  } catch (error) {
    console.error("Error fetching shopping list:", error);
    return c.json({ success: false, error: "Failed to fetch shopping list" }, 500);
  }
});

// POST /shopping-list — create item
shoppingList.post(
  "/",
  zValidator("json", createShoppingListItemSchema),
  async (c) => {
    try {
      const user = getUser(c);
      if (!user.householdId) {
        return c.json({ success: false, error: "User must belong to a household" }, 403);
      }
      const data = c.req.valid("json") as CreateShoppingListItemInput;
      const [created] = await db
        .insert(shoppingListItems)
        .values({
          name: data.name,
          brand: data.brand,
          category: data.category,
          unit: data.unit,
          suggestedQty: String(data.suggestedQty ?? 1),
          sourceItemId: data.sourceItemId,
          status: "pending",
          householdId: user.householdId,
          addedBy: user.id,
        })
        .returning();
      if (!created) {
        return c.json({ success: false, error: "Failed to create shopping list item" }, 500);
      }
      return c.json({ success: true, data: serializeShoppingListItem(created) }, 201);
    } catch (error) {
      console.error("Error creating shopping list item:", error);
      return c.json({ success: false, error: "Failed to create shopping list item" }, 500);
    }
  }
);

// PATCH /shopping-list/:id — update status
shoppingList.patch(
  "/:id",
  zValidator("json", updateShoppingListItemSchema),
  async (c) => {
    try {
      const user = getUser(c);
      const itemId = c.req.param("id");
      if (!user.householdId) {
        return c.json({ success: false, error: "User must belong to a household" }, 403);
      }
      const updates = c.req.valid("json") as UpdateShoppingListItemInput;
      const [updated] = await db
        .update(shoppingListItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(shoppingListItems.id, itemId),
            eq(shoppingListItems.householdId, user.householdId)
          )
        )
        .returning();
      if (!updated) {
        return c.json({ success: false, error: "Shopping list item not found" }, 404);
      }
      return c.json({ success: true, data: serializeShoppingListItem(updated) });
    } catch (error) {
      console.error("Error updating shopping list item:", error);
      return c.json({ success: false, error: "Failed to update shopping list item" }, 500);
    }
  }
);

// DELETE /shopping-list/:id — remove item
shoppingList.delete("/:id", async (c) => {
  try {
    const user = getUser(c);
    const itemId = c.req.param("id");
    if (!user.householdId) {
      return c.json({ success: false, error: "User must belong to a household" }, 403);
    }
    const result = await db
      .delete(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.householdId, user.householdId)
        )
      )
      .returning();
    if (result.length === 0) {
      return c.json({ success: false, error: "Shopping list item not found" }, 404);
    }
    return c.json({ success: true, data: null });
  } catch (error) {
    console.error("Error deleting shopping list item:", error);
    return c.json({ success: false, error: "Failed to delete shopping list item" }, 500);
  }
});

export default shoppingList;
