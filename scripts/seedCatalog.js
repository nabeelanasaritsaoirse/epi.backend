/**
 * ============================================
 * CATALOG SEED SCRIPT (PRODUCTION SAFE)
 * Creates Categories + Subcategories + Products
 * Works with Mongo Atlas
 * ============================================
 */
let faker;
require("dotenv").config();

const connectDB = require("../config/database");
const slugify = require("slugify");

const Category = require("../models/Category");
const Product = require("../models/Product");

// ======================================
// IMAGE FORMAT (CATEGORY SCHEMA)
// ======================================
const createImage = (keyword, type = "main") => ({
  type,
  url: `https://picsum.photos/seed/${encodeURIComponent(keyword)}/600/600`,
  altText: keyword,
  order: 1,
  isActive: true,
});

// ======================================
// CATEGORY STRUCTURE
// ======================================
const catalog = [
  {
    name: "Electronics",
    subs: ["Mobiles", "Laptops", "Headphones", "Smart Watches"],
  },
  {
    name: "Fashion",
    subs: ["Men Clothing", "Women Clothing", "Shoes"],
  },
  {
    name: "Home & Kitchen",
    subs: ["Furniture", "Decor", "Kitchen"],
  },
  {
    name: "Beauty",
    subs: ["Skincare", "Haircare"],
  },
  {
    name: "Sports",
    subs: ["Gym Equipment", "Cycling"],
  },
];

// ======================================
// PRODUCT GENERATOR
// ======================================
function generateProduct(mainCategory, subCategory) {
  const price = faker.number.int({ min: 500, max: 50000 });

  return {
    productId: "PROD-" + faker.string.alphanumeric(8),

    name: faker.commerce.productName(),

    description: {
      short: faker.commerce.productDescription(),
      long: faker.lorem.paragraph(),
    },

    brand: faker.company.name(),

    category: {
      mainCategoryId: mainCategory._id,
      mainCategoryName: mainCategory.name,
      subCategoryId: subCategory._id,
      subCategoryName: subCategory.name,
    },

    pricing: {
      regularPrice: price,
      salePrice: price - 100,
      finalPrice: price - 100,
      currency: "USD",
    },

    availability: {
      stockQuantity: faker.number.int({ min: 20, max: 200 }),
      isAvailable: true,
    },

    images: [
      {
        url: `https://picsum.photos/seed/${encodeURIComponent(subCategory.name)}/600/600`,
        isPrimary: true,
        altText: subCategory.name,
        order: 1,
      },
    ],

    status: "active",
    createdByEmail: "seed@system.com",
  };
}

// ======================================
// MAIN SEED FUNCTION
// ======================================
async function seedCatalog() {

  // ✅ FIX FOR NODE 20 ESM FAKER
  faker = (await import("@faker-js/faker")).faker;
  try {
    await connectDB();

    console.log("\n🚀 Connected to Mongo Atlas");
    console.log("Starting catalog seeding...\n");

    // ✅ SAFETY CHECK (Prevents duplicate data)
    const existingCategories = await Category.countDocuments();

    if (existingCategories > 0) {
      console.log("⚠️ Catalog already exists. Skipping seed.");
      process.exit(0);
    }

    for (const cat of catalog) {
      console.log(`Creating Category → ${cat.name}`);

      const mainCategory = await Category.create({
        categoryId: "CAT-" + faker.string.alphanumeric(6),
        name: cat.name,
        slug: slugify(cat.name, { lower: true }),
        mainImage: createImage(cat.name),
      });

      for (const sub of cat.subs) {
        console.log(`   Subcategory → ${sub}`);

        const subCategory = await Category.create({
          categoryId: "SUB-" + faker.string.alphanumeric(6),
          name: sub,
          slug: slugify(sub, { lower: true }),
          parentCategoryId: mainCategory._id,
          mainImage: createImage(sub),
        });

        mainCategory.subCategories.push(subCategory._id);
        await mainCategory.save();

        // Create products
        for (let i = 0; i < 5; i++) {
          const product = generateProduct(
            mainCategory,
            subCategory
          );

          await Product.create(product);
        }
      }
    }

    console.log("\n🔥 Catalog Successfully Added To LIVE DATABASE");
    console.log("✅ Categories Created");
    console.log("✅ Subcategories Created");
    console.log("✅ Products Created");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed Error:", error);
    process.exit(1);
  }
}

seedCatalog();
