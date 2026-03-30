import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { households, users, items, productCache } from './schema';

// Check for DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Connect to database
const client = postgres(databaseUrl);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create households
    console.log('Creating households...');
    const [household1, household2] = await db
      .insert(households)
      .values([
        {
          name: 'Smith Family',
          inviteCode: 'SMITH2024',
        },
        {
          name: 'Johnson Household',
          inviteCode: 'JOHNSON99',
        },
      ])
      .returning();

    console.log(`✓ Created households: ${household1.name}, ${household2.name}`);

    // Create users
    console.log('Creating users...');
    const [user1, user2, user3, user4] = await db
      .insert(users)
      .values([
        {
          id: '00000000-0000-0000-0000-000000000001', // Mock UUID for development
          householdId: household1.id,
          displayName: 'Alice Smith',
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          householdId: household1.id,
          displayName: 'Bob Smith',
        },
        {
          id: '00000000-0000-0000-0000-000000000003',
          householdId: household2.id,
          displayName: 'Charlie Johnson',
        },
        {
          id: '00000000-0000-0000-0000-000000000004',
          householdId: household2.id,
          displayName: 'Diana Johnson',
        },
      ])
      .returning();

    console.log(`✓ Created ${[user1, user2, user3, user4].length} users`);

    // Create sample items for Smith Family
    console.log('Creating sample items...');
    await db.insert(items).values([
      // Pantry items
      {
        householdId: household1.id,
        name: 'Spaghetti Pasta',
        brand: 'Barilla',
        category: 'Pasta',
        location: 'pantry',
        quantity: '2',
        unit: 'boxes',
        barcodeUpc: '076808501186',
        expirationDate: '2026-12-31',
        expirationEstimated: false,
        addedBy: user1.id,
        notes: 'Whole wheat',
      },
      {
        householdId: household1.id,
        name: 'Peanut Butter',
        brand: 'Jif',
        category: 'Spreads',
        location: 'pantry',
        quantity: '1',
        unit: 'jar',
        barcodeUpc: '051500255261',
        expirationDate: '2025-08-15',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      {
        householdId: household1.id,
        name: 'Canned Tomatoes',
        brand: "Hunt's",
        category: 'Canned Goods',
        location: 'pantry',
        quantity: '4',
        unit: 'cans',
        expirationDate: '2026-06-30',
        expirationEstimated: false,
        addedBy: user2.id,
      },
      {
        householdId: household1.id,
        name: 'Rice',
        brand: 'Jasmine',
        category: 'Grains',
        location: 'pantry',
        quantity: '1',
        unit: 'bag',
        expirationDate: '2027-01-01',
        expirationEstimated: false,
        addedBy: user2.id,
      },
      {
        householdId: household1.id,
        name: 'Olive Oil',
        brand: 'Bertolli',
        category: 'Oils',
        location: 'pantry',
        quantity: '1',
        unit: 'bottle',
        expirationDate: '2025-09-01',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      // Fridge items
      {
        householdId: household1.id,
        name: 'Whole Milk',
        brand: 'Great Value',
        category: 'Dairy',
        location: 'fridge',
        quantity: '1',
        unit: 'gallon',
        barcodeUpc: '078742063300',
        expirationDate: '2026-04-05',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      {
        householdId: household1.id,
        name: 'Eggs',
        brand: 'Happy Farms',
        category: 'Dairy',
        location: 'fridge',
        quantity: '12',
        unit: 'eggs',
        expirationDate: '2026-04-10',
        expirationEstimated: false,
        addedBy: user2.id,
      },
      {
        householdId: household1.id,
        name: 'Cheddar Cheese',
        brand: 'Kraft',
        category: 'Dairy',
        location: 'fridge',
        quantity: '1',
        unit: 'block',
        expirationDate: '2026-04-20',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      {
        householdId: household1.id,
        name: 'Baby Carrots',
        brand: 'Bolthouse Farms',
        category: 'Produce',
        location: 'fridge',
        quantity: '1',
        unit: 'bag',
        expirationDate: '2026-04-02',
        expirationEstimated: true,
        addedBy: user2.id,
        notes: 'Expiration estimated by AI',
      },
      {
        householdId: household1.id,
        name: 'Orange Juice',
        brand: "Tropicana",
        category: 'Beverages',
        location: 'fridge',
        quantity: '1',
        unit: 'carton',
        expirationDate: '2026-04-08',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      // Freezer items
      {
        householdId: household1.id,
        name: 'Chicken Breasts',
        brand: 'Tyson',
        category: 'Meat',
        location: 'freezer',
        quantity: '2',
        unit: 'lbs',
        expirationDate: '2026-09-01',
        expirationEstimated: false,
        addedBy: user2.id,
      },
      {
        householdId: household1.id,
        name: 'Frozen Broccoli',
        brand: 'Birds Eye',
        category: 'Vegetables',
        location: 'freezer',
        quantity: '3',
        unit: 'bags',
        expirationDate: '2026-12-01',
        expirationEstimated: false,
        addedBy: user1.id,
      },
      {
        householdId: household1.id,
        name: 'Ice Cream',
        brand: "Ben & Jerry's",
        category: 'Desserts',
        location: 'freezer',
        quantity: '1',
        unit: 'pint',
        expirationDate: '2026-07-15',
        expirationEstimated: false,
        addedBy: user2.id,
        notes: 'Chocolate Chip Cookie Dough',
      },
      {
        householdId: household1.id,
        name: 'Frozen Pizza',
        brand: 'DiGiorno',
        category: 'Prepared Foods',
        location: 'freezer',
        quantity: '2',
        unit: 'boxes',
        expirationDate: '2026-08-01',
        expirationEstimated: false,
        addedBy: user1.id,
      },
    ]);

    console.log('✓ Created 14 sample items for Smith Family');

    // Create some items for Johnson household
    await db.insert(items).values([
      {
        householdId: household2.id,
        name: 'Almond Milk',
        brand: 'Silk',
        category: 'Dairy Alternatives',
        location: 'fridge',
        quantity: '1',
        unit: 'carton',
        expirationDate: '2026-04-12',
        expirationEstimated: false,
        addedBy: user3.id,
      },
      {
        householdId: household2.id,
        name: 'Quinoa',
        brand: 'Ancient Harvest',
        category: 'Grains',
        location: 'pantry',
        quantity: '1',
        unit: 'box',
        expirationDate: '2027-02-01',
        expirationEstimated: false,
        addedBy: user4.id,
      },
      {
        householdId: household2.id,
        name: 'Ground Beef',
        brand: 'Certified Angus',
        category: 'Meat',
        location: 'freezer',
        quantity: '1.5',
        unit: 'lbs',
        expirationDate: '2026-10-01',
        expirationEstimated: false,
        addedBy: user3.id,
      },
      {
        householdId: household2.id,
        name: 'Greek Yogurt',
        brand: 'Chobani',
        category: 'Dairy',
        location: 'fridge',
        quantity: '6',
        unit: 'cups',
        expirationDate: '2026-04-15',
        expirationEstimated: false,
        addedBy: user4.id,
      },
      {
        householdId: household2.id,
        name: 'Honey',
        brand: 'Nature Nate',
        category: 'Sweeteners',
        location: 'pantry',
        quantity: '1',
        unit: 'jar',
        expirationDate: '2028-01-01',
        expirationEstimated: false,
        addedBy: user3.id,
      },
      {
        householdId: household2.id,
        name: 'Spinach',
        brand: 'Organic Girl',
        category: 'Produce',
        location: 'fridge',
        quantity: '1',
        unit: 'container',
        expirationDate: '2026-04-01',
        expirationEstimated: true,
        addedBy: user4.id,
        notes: 'Expiration estimated',
      },
    ]);

    console.log('✓ Created 6 sample items for Johnson Household');

    // Create product cache entries for common items
    console.log('Creating product cache entries...');
    await db.insert(productCache).values([
      {
        upc: '078742063300',
        name: 'Great Value Whole Milk',
        brand: 'Great Value',
        category: 'Dairy',
        imageUrl: 'https://example.com/milk.jpg',
        source: 'open_food_facts',
      },
      {
        upc: '076808501186',
        name: 'Barilla Spaghetti',
        brand: 'Barilla',
        category: 'Pasta',
        imageUrl: 'https://example.com/pasta.jpg',
        source: 'open_food_facts',
      },
      {
        upc: '051500255261',
        name: 'Jif Creamy Peanut Butter',
        brand: 'Jif',
        category: 'Spreads',
        imageUrl: 'https://example.com/peanutbutter.jpg',
        source: 'open_food_facts',
      },
      {
        upc: '00000000000000',
        name: 'Generic Eggs',
        brand: 'Various',
        category: 'Dairy',
        source: 'manual',
      },
      {
        upc: '11111111111111',
        name: 'Generic Bread',
        brand: 'Various',
        category: 'Bakery',
        source: 'manual',
      },
    ]);

    console.log('✓ Created 5 product cache entries');

    console.log('\n✅ Seeding completed successfully!');
    console.log(`\nCreated:`);
    console.log(`  • 2 households`);
    console.log(`  • 4 users (2 per household)`);
    console.log(`  • 20 items (14 for Smith Family, 6 for Johnson Household)`);
    console.log(`  • 5 product cache entries`);
    console.log(`\nInvite codes:`);
    console.log(`  • Smith Family: SMITH2024`);
    console.log(`  • Johnson Household: JOHNSON99`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
