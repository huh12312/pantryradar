import { faker } from "@faker-js/faker";
import type { ItemLocation } from "@pantrymaid/shared/schemas";

/**
 * Test data factories for creating realistic test data
 */

export const factories = {
  /**
   * Generate a test household
   */
  household: (overrides?: Partial<{
    id: string;
    name: string;
    inviteCode: string;
    createdAt: Date;
  }>) => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    inviteCode: faker.string.alphanumeric(8).toUpperCase(),
    createdAt: faker.date.recent(),
    ...overrides,
  }),

  /**
   * Generate a test user
   */
  user: (householdId: string, overrides?: Partial<{
    id: string;
    displayName: string;
    createdAt: Date;
  }>) => ({
    id: faker.string.uuid(),
    householdId,
    displayName: faker.person.fullName(),
    createdAt: faker.date.recent(),
    ...overrides,
  }),

  /**
   * Generate a test item
   */
  item: (householdId: string, addedBy: string, overrides?: Partial<{
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    location: ItemLocation;
    quantity: string;
    unit: string | null;
    barcodeUpc: string | null;
    expirationDate: Date | null;
    expirationEstimated: boolean;
    addedAt: Date;
    updatedAt: Date;
    notes: string | null;
  }>) => ({
    id: faker.string.uuid(),
    householdId,
    name: faker.commerce.productName(),
    brand: faker.company.name(),
    category: faker.commerce.department(),
    location: faker.helpers.arrayElement(["pantry", "fridge", "freezer"] as ItemLocation[]),
    quantity: faker.number.int({ min: 1, max: 10 }).toString(),
    unit: faker.helpers.arrayElement(["oz", "lb", "g", "kg", "count", null]),
    barcodeUpc: faker.helpers.maybe(() => faker.string.numeric(12), { probability: 0.6 }) ?? null,
    expirationDate: faker.helpers.maybe(() => faker.date.future(), { probability: 0.7 }) ?? null,
    expirationEstimated: faker.datatype.boolean(),
    addedBy,
    addedAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? null,
    ...overrides,
  }),

  /**
   * Generate a test product cache entry
   */
  productCache: (overrides?: Partial<{
    upc: string;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    source: "open_food_facts" | "manual";
    fetchedAt: Date;
  }>) => ({
    upc: faker.string.numeric(12),
    name: faker.commerce.productName(),
    brand: faker.company.name(),
    category: faker.commerce.department(),
    imageUrl: faker.image.url(),
    source: "open_food_facts" as const,
    fetchedAt: faker.date.recent(),
    ...overrides,
  }),

  /**
   * Generate multiple items for a household
   */
  items: (householdId: string, addedBy: string, count: number = 5) => {
    return Array.from({ length: count }, () =>
      factories.item(householdId, addedBy)
    );
  },

  /**
   * Generate a complete household with users and items
   */
  householdWithData: (itemCount: number = 10) => {
    const household = factories.household();
    const user1 = factories.user(household.id);
    const user2 = factories.user(household.id);
    const items = factories.items(household.id, user1.id, itemCount);

    return {
      household,
      users: [user1, user2],
      items,
    };
  },
};
