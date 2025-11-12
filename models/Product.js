const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: String,
  isPrimary: Boolean,
  altText: String
});

const installmentSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  minDownPayment: { 
    type: Number, 
    min: 0
  },
  maxDownPayment: { 
    type: Number, 
    min: 0
  },
  minPaymentAmount: { 
    type: Number, 
    min: 0
  },
  maxPaymentAmount: { 
    type: Number, 
    min: 0
  },
  minInstallmentDays: { 
    type: Number, 
    min: 1
  },
  maxInstallmentDays: { 
    type: Number, 
    min: 1
  },
  interestRate: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  }
});

const referralBonusSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  type: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    default: 'percentage' 
  },
  value: { 
    type: Number, 
    min: 0
  },
  minPurchaseAmount: { 
    type: Number, 
    min: 0,
    default: 0
  }
});

const variantSchema = new mongoose.Schema({
  variantId: { type: String, required: true },
  sku: { type: String, required: true },
  attributes: {
    size: String,
    color: String,
    material: String
  },
  // Optional human-readable description for the variant
  description: {
    short: { type: String },
    long: { type: String }
  },
  // Pricing for the variant
  price: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  // Variant-level installment/payment plan (optional)
  paymentPlan: installmentSchema,
  // Stock & images
  stock: { type: Number, default: 0, min: 0 },
  images: [imageSchema],
  isActive: { type: Boolean, default: true }
});

// FIXED: Remove required: true from finalPrice
// FIXED: Remove required: true from finalPrice
const regionalPricingSchema = new mongoose.Schema({
  region: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  regularPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },
  finalPrice: { type: Number, min: 0 } 
});

const regionalSeoSchema = new mongoose.Schema({
  region: { type: String, required: true },
  metaTitle: String,
  metaDescription: String,
  keywords: [String],
  slug: String
});

const regionalAvailabilitySchema = new mongoose.Schema({
  region: { type: String, required: true },
  stockQuantity: { type: Number, default: 0, min: 0 },
  lowStockLevel: { type: Number, default: 10, min: 0 },
  isAvailable: { type: Boolean, default: true },
  stockStatus: { 
    type: String, 
    enum: ['in_stock', 'out_of_stock', 'low_stock', 'pre_order'],
    default: 'in_stock'
  }
});

const relatedProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  relationType: { 
    type: String, 
    enum: ['cross_sell', 'up_sell', 'complementary', 'similar'],
    required: true 
  }
});

const productSchema = new mongoose.Schema({
  productId: { 
    type: String, 
    required: true, 
    unique: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: {
    short: { type: String, required: true },
    long: String,
    features: [String],
    specifications: mongoose.Schema.Types.Mixed
  },
  category: {
    mainCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    mainCategoryName: { type: String, required: true },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    subCategoryName: String
  },
  brand: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true },
  
  // Enhanced Availability
  availability: {
    isAvailable: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0, min: 0 },
    lowStockLevel: { type: Number, default: 10, min: 0 },
    stockStatus: { 
      type: String, 
      enum: ['in_stock', 'out_of_stock', 'low_stock', 'pre_order'],
      default: 'in_stock'
    }
  },
  
  
  pricing: {
    regularPrice: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    finalPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' }
  },
  
  
  regionalPricing: [regionalPricingSchema],
  
  
  regionalSeo: [regionalSeoSchema],
  
  
  regionalAvailability: [regionalAvailabilitySchema],
  
  
  relatedProducts: [relatedProductSchema],
  
  
  paymentPlan: installmentSchema,
  
  
  origin: {
    country: String,
    manufacturer: String
  },
  
  
  referralBonus: referralBonusSchema,
  
  
  variants: [variantSchema],
  hasVariants: { type: Boolean, default: false },
  
  images: [imageSchema],
  
  
  project: {
    projectId: String,
    projectName: String
  },
  
  
  dimensions: {
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 }
  },
  
  
  warranty: {
    period: { type: Number, min: 0 },
    returnPolicy: { type: Number, min: 0 }
  },
  
  
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  
  
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived', 'active'],
    default: 'draft' 
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  
  if (this.regionalPricing && this.regionalPricing.length > 0) {
    this.regionalPricing.forEach(pricing => {
      if (!pricing.finalPrice) {
        if (pricing.salePrice && pricing.salePrice > 0) {
          pricing.finalPrice = pricing.salePrice;
        } else {
          pricing.finalPrice = pricing.regularPrice;
        }
      }
    });
  }
  
  
  if (this.regionalAvailability && this.regionalAvailability.length > 0) {
    this.regionalAvailability.forEach(availability => {
      if (!availability.stockStatus) {
        if (availability.stockQuantity <= 0) {
          availability.stockStatus = 'out_of_stock';
        } else if (availability.stockQuantity <= availability.lowStockLevel) {
          availability.stockStatus = 'low_stock';
        } else {
          availability.stockStatus = 'in_stock';
        }
      }
    });
  }
  
  
  if (this.pricing && !this.pricing.finalPrice) {
    if (this.pricing.salePrice && this.pricing.salePrice > 0) {
      this.pricing.finalPrice = this.pricing.salePrice;
    } else {
      this.pricing.finalPrice = this.pricing.regularPrice;
    }
  }
  
  
  if (this.availability && !this.availability.stockStatus) {
    if (this.availability.stockQuantity <= 0) {
      this.availability.stockStatus = 'out_of_stock';
    } else if (this.availability.stockQuantity <= this.availability.lowStockLevel) {
      this.availability.stockStatus = 'low_stock';
    } else {
      this.availability.stockStatus = 'in_stock';
    }
  }
  
  next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;