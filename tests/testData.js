/**
 * Test Data for API Health Checks
 * Contains sample data for categories and products
 */

const sampleCategories = [
  {
    name: "Electronics",
    description: "Electronic devices and gadgets",
    displayOrder: 1,
    isFeatured: true,
    showInMenu: true,
    icon: "📱"
  },
  {
    name: "Fashion",
    description: "Clothing and accessories",
    displayOrder: 2,
    isFeatured: true,
    showInMenu: true,
    icon: "👔"
  }
];

const sampleProducts = [
  {
    name: "iPhone 15 Pro",
    description: {
      short: "Latest flagship smartphone from Apple",
      long: "Experience the power of A17 Pro chip",
      features: ["A17 Pro chip", "48MP camera"],
      specifications: { display: "6.1 inch", storage: "256GB" }
    },
    brand: "Apple",
    pricing: { regularPrice: 129900, currency: "INR" },
    availability: { isAvailable: true, stockQuantity: 50 },
    plans: [
      { name: "Standard Plan", days: 60, perDayAmount: 2000, isRecommended: true }
    ],
    status: "published"
  }
];

module.exports = { sampleCategories, sampleProducts };
