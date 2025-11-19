const Product = require('../models/Product');
const { calculateEquivalentValues, generateInstallmentOptions } = require('../utils/productUtils');
const { uploadToS3, deleteFromS3 } = require('../services/awsUploadService');
const multer = require('multer');
const sharp = require('sharp');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif|svg/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Image processing middleware
const processAndUploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    const processedImages = [];
    
    for (const file of req.files) {
      try {
        // Get image metadata
        const metadata = await sharp(file.buffer).metadata();
        
        // Create multiple sizes
        const sizes = [
          { width: 1200, suffix: 'large', quality: 90 },
          { width: 800, suffix: 'medium', quality: 85 },
          { width: 400, suffix: 'small', quality: 80 },
          { width: 200, suffix: 'thumbnail', quality: 75 }
        ];

        const uploadPromises = sizes.map(async (size) => {
          const resizedBuffer = await sharp(file.buffer)
            .resize(size.width, null, {
              fit: 'inside',
              withoutEnlargement: true,
              kernel: sharp.kernel.lanczos3
            })
            .jpeg({
              quality: size.quality,
              chromaSubsampling: '4:4:4'
            })
            .toBuffer();

          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const originalName = file.originalname.split('.')[0];
          const fileName = `${originalName}-${size.suffix}-${timestamp}-${random}.jpg`;
          const folder = 'products/';
          const key = `${folder}${fileName}`;

          const s3Url = await uploadToS3(resizedBuffer, folder, fileName);

          return {
            url: s3Url,
            key: key,
            size: size.suffix,
            width: metadata.width,
            height: metadata.height,
            fileSize: resizedBuffer.length
          };
        });

        const uploadedSizes = await Promise.all(uploadPromises);
        
        // Find the large version as main image
        const mainImage = uploadedSizes.find(img => img.size === 'large');
        
        processedImages.push({
          main: mainImage,
          variants: uploadedSizes.filter(img => img.size !== 'large'),
          alt: file.originalname,
          originalName: file.originalname,
          uploadedAt: new Date()
        });

      } catch (error) {
        console.error(`Error processing image ${file.originalname}:`, error);
        throw new Error(`Failed to process image ${file.originalname}: ${error.message}`);
      }
    }

    req.processedImages = processedImages;
    next();
  } catch (error) {
    console.error('Error in processAndUploadImages:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing images',
      error: error.message
    });
  }
};

// Helper function to delete images from S3
const deleteProductImages = async (images) => {
  try {
    if (!images || !Array.isArray(images)) return;
    
    const deletePromises = [];
    
    for (const image of images) {
      // Delete main image
      if (image.main && image.main.key) {
        deletePromises.push(deleteFromS3(image.main.key));
      }
      
      // Delete variant images
      if (image.variants && Array.isArray(image.variants)) {
        image.variants.forEach(variant => {
          if (variant.key) {
            deletePromises.push(deleteFromS3(variant.key));
          }
        });
      }
    }
    
    await Promise.allSettled(deletePromises);
  } catch (error) {
    console.error('Error deleting product images from S3:', error);
    // Don't throw error here as we don't want to break the main operation
  }
};

// Create product with image upload
exports.createProduct = async (req, res) => {
  try {
    // Generate auto product ID if not provided
    if (!req.body.productId) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      req.body.productId = `PROD${timestamp}${random}`;
    }

    // Parse JSON fields if they are strings
    if (typeof req.body.regionalPricing === 'string') {
      req.body.regionalPricing = JSON.parse(req.body.regionalPricing);
    }
    if (typeof req.body.regionalAvailability === 'string') {
      req.body.regionalAvailability = JSON.parse(req.body.regionalAvailability);
    }
    if (typeof req.body.regionalSeo === 'string') {
      req.body.regionalSeo = JSON.parse(req.body.regionalSeo);
    }
    if (typeof req.body.relatedProducts === 'string') {
      req.body.relatedProducts = JSON.parse(req.body.relatedProducts);
    }
    if (typeof req.body.variants === 'string') {
      req.body.variants = JSON.parse(req.body.variants);
    }

    // Add processed images to request body
    if (req.processedImages && req.processedImages.length > 0) {
      req.body.images = req.processedImages;
    }

    // Auto-calculate final prices if not provided
    if (req.body.regionalPricing) {
      req.body.regionalPricing = req.body.regionalPricing.map(pricing => ({
        ...pricing,
        finalPrice: pricing.finalPrice || pricing.salePrice || pricing.regularPrice
      }));
    }

    // Auto-calculate stock status if not provided
    if (req.body.regionalAvailability) {
      req.body.regionalAvailability = req.body.regionalAvailability.map(availability => ({
        ...availability,
        stockStatus: availability.stockStatus || 
          (availability.stockQuantity <= 0 ? 'out_of_stock' : 
           availability.stockQuantity <= (availability.lowStockLevel || 10) ? 'low_stock' : 'in_stock')
      }));
    }

    // Set default values for nested objects
    const productData = {
      ...req.body,
      availability: {
        isAvailable: true,
        stockQuantity: 0,
        lowStockLevel: 10,
        stockStatus: 'in_stock',
        ...req.body.availability
      },
      pricing: {
        currency: 'USD',
        finalPrice: req.body.pricing?.salePrice || req.body.pricing?.regularPrice || 0,
        ...req.body.pricing
      },
      regionalPricing: req.body.regionalPricing || [],
      regionalSeo: req.body.regionalSeo || [],
      regionalAvailability: req.body.regionalAvailability || [],
      relatedProducts: req.body.relatedProducts || [],
      images: req.body.images || [], // Now includes S3 data
      status: req.body.status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle variants if provided
    productData.hasVariants = !!req.body.hasVariants;
    if (productData.hasVariants) {
      if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
        // Clean up uploaded images if validation fails
        if (req.processedImages) {
          await deleteProductImages(req.processedImages);
        }
        return res.status(400).json({ 
          success: false, 
          message: 'variants array is required when hasVariants is true' 
        });
      }

      // Normalize variants: ensure variantId and sku exist, validate price
      const normalizedVariants = req.body.variants.map((v, idx) => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const variantId = v.variantId || `VAR${timestamp}${random}`;

        const skuBase = req.body.sku || req.body.productId || `PROD${timestamp}`;
        const sku = v.sku || `${skuBase}-${idx + 1}-${variantId.slice(-4)}`;

        if (v.price === undefined || v.price === null) {
          throw new Error(`Each variant must include a price. Missing for variant at index ${idx}`);
        }

        return {
          variantId,
          sku,
          attributes: v.attributes || {},
          description: v.description || {},
          price: v.price,
          salePrice: v.salePrice,
          paymentPlan: v.paymentPlan || {},
          stock: v.stock || 0,
          images: v.images || [], // Variant images would need separate upload handling
          isActive: v.isActive !== undefined ? v.isActive : true
        };
      });

      productData.variants = normalizedVariants;
    }

    const product = new Product(productData);
    await product.save();
    
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        productId: product.productId,
        name: product.name,
        sku: product.sku,
        images: product.images.length
      }
    });
  } catch (error) {
    // Clean up uploaded images if product creation fails
    if (req.processedImages) {
      await deleteProductImages(req.processedImages);
    }
    
    console.error('Error creating product:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product ID or SKU already exists"
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status,
      region = 'global'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'regionalSeo.metaTitle': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) filter['category.main'] = category;
    if (brand) filter.brand = brand;
    if (status) filter.status = status;
    
    // Regional availability filter
    if (region && region !== 'all') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
    }
    
    // Price range filter for specific region
    if ((minPrice || maxPrice) && region && region !== 'all') {
      filter['regionalPricing'] = {
        $elemMatch: {
          region: region,
          finalPrice: {}
        }
      };
      if (minPrice) filter['regionalPricing'].$elemMatch.finalPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter['regionalPricing'].$elemMatch.finalPrice.$lte = parseFloat(maxPrice);
    }

    // Execute query with pagination
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination info
    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get product statistics
exports.getProductStats = async (req, res) => {
  try {
    const { region = 'global' } = req.query;
    
    const filter = {};
    if (region && region !== 'global') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
    }

    const totalProducts = await Product.countDocuments(filter);
    
    const inStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        { 'availability.stockQuantity': { $gt: 0 } },
        { 'regionalAvailability.stockQuantity': { $gt: 0 } }
      ]
    });

    const lowStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        { 
          'availability.stockQuantity': { $gt: 0, $lte: 10 },
          'availability.stockStatus': 'low_stock'
        },
        { 
          'regionalAvailability.stockQuantity': { $gt: 0, $lte: 10 },
          'regionalAvailability.stockStatus': 'low_stock'
        }
      ]
    });

    const outOfStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        { 'availability.stockQuantity': 0 },
        { 'regionalAvailability.stockQuantity': 0 }
      ]
    });

    res.json({
      success: true,
      data: {
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts
      }
    });
  } catch (error) {
    console.error('Error getting product stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Update product with image upload capability
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    if (!product) {
      // Clean up uploaded images if product not found
      if (req.processedImages) {
        await deleteProductImages(req.processedImages);
      }
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Parse JSON fields if they are strings
    if (typeof req.body.regionalPricing === 'string') {
      req.body.regionalPricing = JSON.parse(req.body.regionalPricing);
    }
    if (typeof req.body.regionalAvailability === 'string') {
      req.body.regionalAvailability = JSON.parse(req.body.regionalAvailability);
    }
    if (typeof req.body.regionalSeo === 'string') {
      req.body.regionalSeo = JSON.parse(req.body.regionalSeo);
    }
    if (typeof req.body.relatedProducts === 'string') {
      req.body.relatedProducts = JSON.parse(req.body.relatedProducts);
    }
    if (typeof req.body.variants === 'string') {
      req.body.variants = JSON.parse(req.body.variants);
    }

    // Store old images for cleanup if new images are uploaded
    const oldImages = product.images ? [...product.images] : [];

    // Add new processed images if any
    if (req.processedImages && req.processedImages.length > 0) {
      // If replacing images, delete old ones
      if (req.body.replaceImages) {
        await deleteProductImages(oldImages);
        req.body.images = req.processedImages;
      } else {
        // Add to existing images
        req.body.images = [...(product.images || []), ...req.processedImages];
      }
    }

    // If variants provided, normalize and replace
    if (req.body.hasVariants !== undefined) {
      product.hasVariants = !!req.body.hasVariants;
    }

    if (req.body.variants) {
      if (!Array.isArray(req.body.variants)) {
        return res.status(400).json({ success: false, message: 'variants must be an array' });
      }

      const normalizedVariants = req.body.variants.map((v, idx) => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const variantId = v.variantId || `VAR${timestamp}${random}`;
        const skuBase = req.body.sku || product.sku || product.productId || `PROD${timestamp}`;
        const sku = v.sku || `${skuBase}-${idx + 1}-${variantId.slice(-4)}`;

        if (v.price === undefined || v.price === null) {
          throw new Error(`Each variant must include a price. Missing for variant at index ${idx}`);
        }

        return {
          variantId,
          sku,
          attributes: v.attributes || {},
          description: v.description || {},
          price: v.price,
          salePrice: v.salePrice,
          paymentPlan: v.paymentPlan || {},
          stock: v.stock || 0,
          images: v.images || [],
          isActive: v.isActive !== undefined ? v.isActive : true
        };
      });

      product.variants = normalizedVariants;
    }

    // Merge other top-level fields (safe shallow merge)
    const updatableFields = ['name','description','brand','pricing','availability','regionalPricing','regionalSeo','regionalAvailability','relatedProducts','paymentPlan','origin','referralBonus','images','project','dimensions','warranty','seo','status'];
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    product.updatedAt = new Date();
    await product.save();

    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) {
    // Clean up uploaded images if update fails
    if (req.processedImages) {
      await deleteProductImages(req.processedImages);
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product ID or SKU already exists"
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Delete product with S3 cleanup
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Delete all associated images from S3
    if (product.images && product.images.length > 0) {
      await deleteProductImages(product.images);
    }

    // Delete variant images if any
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.images && variant.images.length > 0) {
          await deleteProductImages(variant.images);
        }
      }
    }

    await Product.findOneAndDelete({ productId: req.params.productId });

    res.json({ 
      success: true, 
      message: "Product and associated images deleted successfully" 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Add product images
exports.addProductImages = async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    if (!product) {
      // Clean up uploaded images if product not found
      if (req.processedImages) {
        await deleteProductImages(req.processedImages);
      }
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!req.processedImages || req.processedImages.length === 0) {
      return res.status(400).json({ success: false, message: 'No images provided' });
    }

    // Add new images to product
    if (!product.images) {
      product.images = [];
    }
    
    product.images.push(...req.processedImages);
    product.updatedAt = new Date();
    
    await product.save();

    res.json({
      success: true,
      message: `Successfully added ${req.processedImages.length} images to product`,
      data: {
        totalImages: product.images.length,
        newImages: req.processedImages
      }
    });
  } catch (error) {
    // Clean up uploaded images if operation fails
    if (req.processedImages) {
      await deleteProductImages(req.processedImages);
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Delete specific product image
exports.deleteProductImage = async (req, res) => {
  try {
    const { productId, imageIndex } = req.params;
    
    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.images || product.images.length === 0) {
      return res.status(400).json({ success: false, message: 'No images found for this product' });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= product.images.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index' });
    }

    const imageToDelete = product.images[index];
    
    // Delete from S3
    await deleteProductImages([imageToDelete]);
    
    // Remove from array
    product.images.splice(index, 1);
    product.updatedAt = new Date();
    
    await product.save();

    res.json({
      success: true,
      message: 'Image deleted successfully',
      data: {
        remainingImages: product.images.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10, region = 'global' } = req.query;

    const filter = { 'category.main': category };
    
    if (region && region !== 'all') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get low stock products
exports.getLowStockProducts = async (req, res) => {
  try {
    const { region = 'global' } = req.query;
    
    const filter = {
      'availability.stockStatus': 'low_stock',
      'availability.isAvailable': true
    };
    
    if (region && region !== 'all') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
      filter['regionalAvailability.stockStatus'] = 'low_stock';
    }

    const lowStockProducts = await Product.find(filter).sort({ 'availability.stockQuantity': 1 });

    res.json({
      success: true,
      data: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get products by region
exports.getProductsByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status
    } = req.query;

    // Build filter object
    const filter = {
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'description.short': { $regex: search, $options: 'i' } },
        { 'description.long': { $regex: search, $options: 'i' } },
        { 'regionalSeo.metaTitle': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) filter['category.main'] = category;
    if (brand) filter.brand = brand;
    if (status) filter.status = status;
    
    // Price range filter for specific region
    if (minPrice || maxPrice) {
      filter['regionalPricing'] = {
        $elemMatch: {
          region: region,
          finalPrice: {}
        }
      };
      if (minPrice) filter['regionalPricing'].$elemMatch.finalPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter['regionalPricing'].$elemMatch.finalPrice.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Add regional pricing
exports.addRegionalPricing = async (req, res) => {
  try {
    const { productId } = req.params;
    const { region, currency, regularPrice, salePrice, costPrice } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Remove existing pricing for this region
    product.regionalPricing = product.regionalPricing.filter(
      p => p.region !== region
    );

    // Add new pricing
    product.regionalPricing.push({
      region,
      currency,
      regularPrice,
      salePrice,
      costPrice,
      finalPrice: salePrice || regularPrice
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional pricing added successfully",
      data: product.regionalPricing
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Add regional availability
exports.addRegionalAvailability = async (req, res) => {
  try {
    const { productId } = req.params;
    const { region, stockQuantity, lowStockLevel, isAvailable = true } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Calculate stock status
    let stockStatus = 'in_stock';
    if (stockQuantity <= 0) {
      stockStatus = 'out_of_stock';
    } else if (stockQuantity <= (lowStockLevel || 10)) {
      stockStatus = 'low_stock';
    }

    // Remove existing availability for this region
    product.regionalAvailability = product.regionalAvailability.filter(
      a => a.region !== region
    );

    // Add new availability
    product.regionalAvailability.push({
      region,
      stockQuantity,
      lowStockLevel: lowStockLevel || 10,
      isAvailable,
      stockStatus
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional availability added successfully",
      data: product.regionalAvailability
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Add regional SEO
exports.addRegionalSeo = async (req, res) => {
  try {
    const { productId } = req.params;
    const { region, metaTitle, metaDescription, keywords, slug } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Remove existing SEO for this region
    product.regionalSeo = product.regionalSeo.filter(s => s.region !== region);

    // Add new SEO
    product.regionalSeo.push({
      region,
      metaTitle,
      metaDescription,
      keywords: Array.isArray(keywords) ? keywords : (keywords ? keywords.split(',').map(k => k.trim()) : []),
      slug
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional SEO added successfully",
      data: product.regionalSeo
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Add related products
exports.addRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { relatedProducts } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Validate related products exist
    for (const relatedProduct of relatedProducts) {
      const exists = await Product.findOne({ productId: relatedProduct.productId });
      if (!exists) {
        return res.status(400).json({
          success: false,
          message: `Related product ${relatedProduct.productId} not found`
        });
      }
    }

    product.relatedProducts = relatedProducts;
    await product.save();

    res.json({
      success: true,
      message: "Related products added successfully",
      data: product.relatedProducts
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get product by region
exports.getProductByRegion = async (req, res) => {
  try {
    const { productId, region } = req.params;

    const product = await Product.findOne({ 
      productId,
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found in specified region" 
      });
    }

    // Filter data for specific region
    const regionalPricing = product.regionalPricing.find(p => p.region === region);
    const regionalSeo = product.regionalSeo.find(s => s.region === region);
    const regionalAvailability = product.regionalAvailability.find(a => a.region === region);

    const regionalData = {
      productId: product.productId,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      pricing: regionalPricing,
      seo: regionalSeo,
      availability: regionalAvailability,
      images: product.images,
      variants: product.variants,
      hasVariants: product.hasVariants,
      project: product.project,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    res.json({
      success: true,
      data: regionalData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Bulk update regional pricing
exports.bulkUpdateRegionalPricing = async (req, res) => {
  try {
    const { updates } = req.body;

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, region, currency, regularPrice, salePrice, costPrice } = update;
        
        const product = await Product.findOne({ productId });
        if (!product) {
          errors.push(`Product ${productId} not found`);
          continue;
        }

        // Remove existing pricing for this region
        product.regionalPricing = product.regionalPricing.filter(
          p => p.region !== region
        );

        // Add new pricing
        product.regionalPricing.push({
          region,
          currency,
          regularPrice,
          salePrice,
          costPrice,
          finalPrice: salePrice || regularPrice
        });

        await product.save();
        results.push({ productId, region, status: 'success' });
      } catch (error) {
        errors.push(`Failed to update ${update.productId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Bulk update completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        results,
        errors
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get regional statistics
exports.getRegionalStats = async (req, res) => {
  try {
    const { region } = req.params;

    const totalProducts = await Product.countDocuments({
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true
    });

    const inStockProducts = await Product.countDocuments({
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true,
      'regionalAvailability.stockStatus': 'in_stock'
    });

    const lowStockProducts = await Product.countDocuments({
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true,
      'regionalAvailability.stockStatus': 'low_stock'
    });

    const outOfStockProducts = await Product.countDocuments({
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true,
      'regionalAvailability.stockStatus': 'out_of_stock'
    });

    // Get average price for the region
    const products = await Product.find({
      'regionalAvailability.region': region,
      'regionalAvailability.isAvailable': true
    });

    let totalPrice = 0;
    let priceCount = 0;

    products.forEach(product => {
      const regionalPricing = product.regionalPricing.find(p => p.region === region);
      if (regionalPricing && regionalPricing.finalPrice) {
        totalPrice += regionalPricing.finalPrice;
        priceCount++;
      }
    });

    const averagePrice = priceCount > 0 ? totalPrice / priceCount : 0;

    res.json({
      success: true,
      data: {
        region,
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        averagePrice: Math.round(averagePrice * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Sync regional data
exports.syncRegionalData = async (req, res) => {
  try {
    const { productId } = req.params;
    const { sourceRegion, targetRegions } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    const sourcePricing = product.regionalPricing.find(p => p.region === sourceRegion);
    const sourceSeo = product.regionalSeo.find(s => s.region === sourceRegion);
    const sourceAvailability = product.regionalAvailability.find(a => a.region === sourceRegion);

    if (!sourcePricing) {
      return res.status(400).json({
        success: false,
        message: `No pricing data found for source region ${sourceRegion}`
      });
    }

    const results = [];

    for (const targetRegion of targetRegions) {
      // Sync pricing
      product.regionalPricing = product.regionalPricing.filter(p => p.region !== targetRegion);
      product.regionalPricing.push({
        ...sourcePricing.toObject ? sourcePricing.toObject() : sourcePricing,
        region: targetRegion
      });

      // Sync SEO if exists
      if (sourceSeo) {
        product.regionalSeo = product.regionalSeo.filter(s => s.region !== targetRegion);
        product.regionalSeo.push({
          ...sourceSeo.toObject ? sourceSeo.toObject() : sourceSeo,
          region: targetRegion
        });
      }

      // Sync availability if exists
      if (sourceAvailability) {
        product.regionalAvailability = product.regionalAvailability.filter(a => a.region !== targetRegion);
        product.regionalAvailability.push({
          ...sourceAvailability.toObject ? sourceAvailability.toObject() : sourceAvailability,
          region: targetRegion
        });
      }

      results.push(targetRegion);
    }

    await product.save();

    res.json({
      success: true,
      message: `Regional data synced from ${sourceRegion} to ${results.length} regions`,
      data: {
        syncedRegions: results
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get products by project
exports.getProductsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10, region = 'global' } = req.query;

    const filter = { 'project.projectId': projectId };
    
    if (region && region !== 'all') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    
    const projectProducts = await Product.find({ 'project.projectId': projectId });
    const regions = [...new Set(projectProducts.flatMap(p => p.regionalAvailability.map(a => a.region)))];

    res.json({
      success: true,
      data: products,
      projectSummary: {
        totalProducts: total,
        regions,
        projectId
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Advanced product search
exports.searchProductsAdvanced = async (req, res) => {
  try {
    const {
      query,
      region = 'global',
      category,
      brand,
      minPrice,
      maxPrice,
      inStock = false,
      hasVariants = false,
      projectId,
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { 'description.short': { $regex: query, $options: 'i' } },
        { 'description.long': { $regex: query, $options: 'i' } },
        { 'regionalSeo.metaTitle': { $regex: query, $options: 'i' } },
        { 'regionalSeo.metaDescription': { $regex: query, $options: 'i' } },
        { 'regionalSeo.keywords': { $in: [new RegExp(query, 'i')] } }
      ];
    }

    
    if (region && region !== 'all') {
      filter['regionalAvailability.region'] = region;
      filter['regionalAvailability.isAvailable'] = true;
    }

    
    if (category) filter['category.main'] = category;
    if (brand) filter.brand = brand;
    if (projectId) filter['project.projectId'] = projectId;
    if (hasVariants) filter.hasVariants = true;
    
    if (inStock) {
      filter['regionalAvailability.stockQuantity'] = { $gt: 0 };
    }

    
    if ((minPrice || maxPrice) && region && region !== 'all') {
      filter['regionalPricing'] = {
        $elemMatch: {
          region: region,
          finalPrice: {}
        }
      };
      if (minPrice) filter['regionalPricing'].$elemMatch.finalPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter['regionalPricing'].$elemMatch.finalPrice.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Export the upload middleware for use in routes
exports.upload = upload;
exports.processAndUploadImages = processAndUploadImages;

// Mark product as featured
exports.markAsFeatured = async (req, res) => {
  try {
    const { productId } = req.params;
    const { featuredRank = 0, featuredStartDate, featuredEndDate } = req.body;

    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isFeatured = true;
    product.featuredRank = featuredRank;
    if (featuredStartDate) product.featuredStartDate = new Date(featuredStartDate);
    if (featuredEndDate) product.featuredEndDate = new Date(featuredEndDate);

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product marked as featured',
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Remove featured status from product
exports.removeFromFeatured = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isFeatured = false;
    product.featuredRank = 0;
    product.featuredStartDate = null;
    product.featuredEndDate = null;

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product removed from featured',
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all featured products
exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const products = await Product.find({
      isFeatured: true,
      $or: [
        { featuredEndDate: null },
        { featuredEndDate: { $gte: new Date() } }
      ]
    })
      .sort({ featuredRank: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({
      isFeatured: true,
      $or: [
        { featuredEndDate: null },
        { featuredEndDate: { $gte: new Date() } }
      ]
    });

    res.status(200).json({
      success: true,
      count: products.length,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
        total
      },
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Bulk update featured status
exports.bulkUpdateFeatured = async (req, res) => {
  try {
    const { productIds, isFeatured, featuredRank = 0 } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'productIds array is required'
      });
    }

    const updateData = {
      isFeatured
    };

    if (isFeatured && featuredRank !== undefined) {
      updateData.featuredRank = featuredRank;
    }

    const result = await Product.updateMany(
      { productId: { $in: productIds } },
      updateData
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} products updated`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reorder featured products
exports.reorderFeatured = async (req, res) => {
  try {
    const { products } = req.body; // Array of { productId, featuredRank }

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'products array with featuredRank is required'
      });
    }

    const updatePromises = products.map(item =>
      Product.updateOne(
        { productId: item.productId },
        { featuredRank: item.featuredRank }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Featured products reordered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};