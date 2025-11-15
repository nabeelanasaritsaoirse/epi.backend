const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");

// CONNECT TO DATABASE
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("🌍 Connected to Production DB");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
}

// SEED CATEGORIES (FIXED — categoryId ADDED)
// SEED CATEGORIES (FIXED — categoryId + slug ADDED)
async function seedCategories() {
  await Category.deleteMany({});

  const categories = [
    {
      categoryId: "CAT001",
      name: "Electronics",
      slug: "electronics",
      parentCategoryId: null,
      subCategories: [],
      isActive: true,
      displayOrder: 1,
      meta: { keywords: [], description: "" }
    },
    {
      categoryId: "CAT002",
      name: "Mobiles",
      slug: "mobiles",
      parentCategoryId: null,
      subCategories: [],
      isActive: true,
      displayOrder: 2,
      meta: { keywords: [], description: "" }
    },
    {
      categoryId: "CAT003",
      name: "Home Appliances",
      slug: "home-appliances",
      parentCategoryId: null,
      subCategories: [],
      isActive: true,
      displayOrder: 3,
      meta: { keywords: [], description: "" }
    },
  ];

  const created = await Category.insertMany(categories);
  console.log(`📦 Created ${created.length} categories`);

  return created;
}


// SEED PRODUCTS (USING categoryId + categoryObjectId)
async function seedProducts(categories) {
  await Product.deleteMany({});

  const products = [
    {
      productId: "P1001",
      name: "Demo Product",
      brand: "BrandX",
      description: {
        short: "Short description here",
        long: "",
        features: [],
        specifications: {},
      },
      category: {
        mainCategoryId: categories[0]._id,
        mainCategoryName: categories[0].name,
      },
      pricing: {
        regularPrice: 3399,
        salePrice: 3299,
        finalPrice: 3299,
        currency: "INR",
      },
      status: "published",
    },
  ];

  const created = await Product.insertMany(products);
  console.log(`🛒 Created ${created.length} products`);

  return created;
}

// OPTIONAL: SEED ADMIN USER
async function seedAdmin() {
  const existing = await User.findOne({ email: "admin@yourapp.com" });

  if (existing) {
    console.log("👑 Admin already exists — skipping");
    return existing;
  }

  const adminUser = await User.create({
    name: "Admin User",
    email: "admin@yourapp.com",
    firebaseUid: "admin_firebase_uid_prod",
    role: "admin",
    isActive: true,
    wallet: { balance: 0, transactions: [] },
  });

  console.log("👑 Admin user created:");

  return adminUser;
}

async function run() {
  await connectDB();

  console.log("\n🚀 Starting Production Seed...\n");

  const categories = await seedCategories();
  const products = await seedProducts(categories);
  const admin = await seedAdmin();

  console.log("\n=== ✅ PRODUCTION SEED COMPLETED SUCCESSFULLY ===");
  console.log({
    categories: categories.length,
    products: products.length,
    adminId: admin._id,
  });

  mongoose.connection.close();
}

run().catch((err) => {
  console.error("❌ Seed Failed:", err);
  mongoose.connection.close();
});
