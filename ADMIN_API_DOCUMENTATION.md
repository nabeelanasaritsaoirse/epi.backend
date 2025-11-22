# Admin Panel API Documentation - Products & Categories

## Table of Contents
1. [Product APIs](#product-apis)
2. [Category APIs](#category-apis)
3. [Common Response Format](#common-response-format)
4. [Error Handling](#error-handling)

---

## Product APIs

### Base URL: `/api/products`

### 1. Create Product
**POST** `/api/products`

Create a new product with all details.

**Request Body:**
```json
{
  "productId": "PROD123456789",  // Optional - Auto-generated if not provided
  "name": "Product Name",  // Required
  "description": {
    "short": "Short description",  // Required
    "long": "Detailed description",  // Optional
    "features": ["Feature 1", "Feature 2"],  // Optional
    "specifications": {  // Optional
      "color": "Blue",
      "weight": "500g"
    }
  },
  "category": {
    "mainCategoryId": "507f1f77bcf86cd799439011",  // Required (MongoDB ObjectID)
    "mainCategoryName": "Electronics",  // Required
    "subCategoryId": "507f1f77bcf86cd799439012",  // Optional (MongoDB ObjectID)
    "subCategoryName": "Mobile Phones"  // Optional
  },
  "brand": "Samsung",  // Required
  "sku": "SKU-001",  // Optional - Unique identifier

  // Availability
  "availability": {
    "isAvailable": true,  // Default: true
    "stockQuantity": 100,  // Default: 0
    "lowStockLevel": 10,  // Default: 10
    "stockStatus": "in_stock"  // enum: 'in_stock', 'out_of_stock', 'low_stock', 'pre_order'
  },

  // Pricing
  "pricing": {
    "regularPrice": 50000,  // Required for pricing
    "salePrice": 45000,  // Optional
    "finalPrice": 45000,  // Auto-calculated (salePrice or regularPrice)
    "costPrice": 40000,  // Optional
    "currency": "INR"  // Default: USD
  },

  // Regional Pricing (for different regions)
  "regionalPricing": [
    {
      "region": "north",
      "currency": "INR",
      "regularPrice": 50000,
      "salePrice": 45000,
      "costPrice": 40000,
      "finalPrice": 45000  // Auto-calculated
    }
  ],

  // Regional Availability
  "regionalAvailability": [
    {
      "region": "north",
      "stockQuantity": 50,
      "lowStockLevel": 10,
      "isAvailable": true,
      "stockStatus": "in_stock"  // Auto-calculated
    }
  ],

  // Regional SEO
  "regionalSeo": [
    {
      "region": "north",
      "metaTitle": "Product Title",
      "metaDescription": "Product Description",
      "keywords": ["keyword1", "keyword2"],
      "slug": "product-slug"
    }
  ],

  // Payment Plans (Admin-created investment plans)
  "plans": [
    {
      "name": "Quick Plan",  // Required
      "days": 30,  // Required
      "perDayAmount": 1500,  // Required
      "totalAmount": 45000,  // Auto-calculated (days * perDayAmount)
      "isRecommended": true,  // Default: false
      "description": "Pay in 30 days"  // Optional
    }
  ],

  // Payment Plan Options
  "paymentPlan": {
    "enabled": true,
    "minDownPayment": 5000,
    "maxDownPayment": 20000,
    "minPaymentAmount": 100,
    "maxPaymentAmount": 5000,
    "minInstallmentDays": 7,
    "maxInstallmentDays": 365,
    "interestRate": 0  // percentage
  },

  // Referral Bonus
  "referralBonus": {
    "enabled": true,
    "type": "percentage",  // enum: 'percentage', 'fixed'
    "value": 5,
    "minPurchaseAmount": 10000
  },

  // Product Images
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "isPrimary": true,  // First image is primary by default
      "altText": "Product image"
    }
  ],

  // Variants (if product has variants)
  "hasVariants": false,  // Default: false
  "variants": [
    {
      "variantId": "VAR123",  // Auto-generated if not provided
      "sku": "SKU-001-VAR1",  // Required for variants
      "attributes": {
        "size": "Large",
        "color": "Blue",
        "material": "Cotton"
      },
      "description": {
        "short": "Blue variant",
        "long": "Detailed variant description"
      },
      "price": 46000,  // Required
      "salePrice": 44000,  // Optional
      "paymentPlan": {},  // Optional variant-level payment plan
      "stock": 20,
      "images": [
        {
          "url": "https://example.com/variant.jpg",
          "isPrimary": true,
          "altText": "Variant image"
        }
      ],
      "isActive": true
    }
  ],

  // Related Products
  "relatedProducts": [
    {
      "productId": "PROD987654321",
      "relationType": "cross_sell"  // enum: 'cross_sell', 'up_sell', 'complementary', 'similar'
    }
  ],

  // Project Association
  "project": {
    "projectId": "PROJ001",
    "projectName": "Summer Sale 2024"
  },

  // Product Origin
  "origin": {
    "country": "India",
    "manufacturer": "Samsung India"
  },

  // Dimensions
  "dimensions": {
    "weight": 500,  // grams
    "length": 15,   // cm
    "width": 8,     // cm
    "height": 1     // cm
  },

  // Warranty
  "warranty": {
    "period": 12,  // months
    "returnPolicy": 7  // days
  },

  // SEO
  "seo": {
    "metaTitle": "Product Meta Title",
    "metaDescription": "Product meta description",
    "keywords": ["keyword1", "keyword2"]
  },

  // Status
  "status": "draft",  // enum: 'draft', 'published', 'archived', 'active'

  // Product Categorization
  "isPopular": false,
  "isBestSeller": false,
  "isTrending": false
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "productId": "PROD123456789",
    "name": "Product Name",
    "sku": "SKU-001"
  }
}
```

---

### 2. Get All Products
**GET** `/api/products`

Get all products with pagination and filters.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10)
- `search` (string) - Search in name, description, SEO
- `category` (string) - Filter by category
- `brand` (string) - Filter by brand
- `minPrice` (number) - Minimum price
- `maxPrice` (number) - Maximum price
- `status` (string) - Filter by status
- `region` (string, default: 'global') - Filter by region

**Example:** `/api/products?page=1&limit=20&search=phone&brand=Samsung`

**Success Response:**
```json
{
  "success": true,
  "data": [/* array of products */],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3. Get Product by ID
**GET** `/api/products/:productId`

Get single product details.

**Success Response:**
```json
{
  "success": true,
  "data": {/* complete product object */}
}
```

---

### 4. Update Product
**PUT** `/api/products/:productId`

Update existing product. You can send partial updates.

**Request Body:** Same as Create Product (all fields are optional for update)

**Success Response:**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {/* updated product object */}
}
```

---

### 5. Delete Product
**DELETE** `/api/products/:productId`

Delete a product permanently.

**Success Response:**
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### 6. Update Product Images
**PUT** `/api/products/:productId/images`

Upload and update product images. Files are automatically uploaded to S3 and resized.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `images` (files, required) - Multiple image files (max 10 files)
- `altText` (string, optional) - Alt text for images

**Supported File Types:** JPEG, JPG, PNG, WebP
**Max File Size:** 10MB per file
**Auto-Processing:** Images are automatically resized (800px width) and converted to JPEG

**Example using Postman:**
1. Select PUT method
2. URL: `http://localhost:5000/api/products/PROD123/images`
3. Body → form-data
4. Add key `images` (type: File) → select multiple image files
5. Add key `altText` (type: Text) → "Product image" (optional)

**Success Response:**
```json
{
  "success": true,
  "message": "Product images uploaded and updated successfully",
  "data": {
    "productId": "PROD123",
    "images": [
      {
        "url": "https://bucket.s3.region.amazonaws.com/products/1234567-abc123.jpg",
        "isPrimary": true,
        "altText": "Product image"
      }
    ],
    "uploadedCount": 3
  }
}
```

---

### 7. Update Product SEO
**PUT** `/api/products/:productId/seo`

Update product SEO metadata.

**Request Body:**
```json
{
  "metaTitle": "Product Title",
  "metaDescription": "Product description for SEO",
  "keywords": ["keyword1", "keyword2"]
}
```

---

### 8. Update Product Plans
**PUT** `/api/products/:productId/plans`

Update investment/payment plans.

**Request Body:**
```json
{
  "plans": [
    {
      "name": "Quick Plan",
      "days": 30,
      "perDayAmount": 1500,
      "isRecommended": true,
      "description": "Pay in 30 days"
    }
  ]
}
```

---

### 9. Update Variant Images
**PUT** `/api/products/:productId/variants/:variantId/images`

Upload and update variant-specific images. Files are automatically uploaded to S3.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `images` (files, required) - Multiple image files (max 10 files)
- `altText` (string, optional) - Alt text for variant images

**Supported File Types:** JPEG, JPG, PNG, WebP
**Max File Size:** 10MB per file
**Auto-Processing:** Images are automatically resized (800px width) and converted to JPEG

**Success Response:**
```json
{
  "success": true,
  "message": "Variant images uploaded and updated successfully",
  "data": {
    "productId": "PROD123",
    "variantId": "VAR456",
    "images": [
      {
        "url": "https://bucket.s3.region.amazonaws.com/products/variants/VAR456/1234567-abc123.jpg",
        "isPrimary": true,
        "altText": "Blue variant image"
      }
    ],
    "uploadedCount": 2
  }
}
```

---

### 10. Get Product Stats
**GET** `/api/products/stats`

Get product statistics.

**Query Parameters:**
- `region` (string, default: 'global')

**Success Response:**
```json
{
  "success": true,
  "data": {
    "totalProducts": 500,
    "inStockProducts": 450,
    "lowStockProducts": 30,
    "outOfStockProducts": 20
  }
}
```

---

### 11. Search Products (Advanced)
**GET** `/api/products/search`

Advanced product search with multiple filters.

**Query Parameters:**
- `query` (string) - Search text
- `region` (string)
- `category` (string)
- `brand` (string)
- `minPrice` (number)
- `maxPrice` (number)
- `inStock` (boolean)
- `hasVariants` (boolean)
- `projectId` (string)
- `page` (number)
- `limit` (number)

---

### 12. Get Low Stock Products
**GET** `/api/products/low-stock`

Get products with low stock.

**Query Parameters:**
- `region` (string)

---

### 13. Get Products by Category
**GET** `/api/products/category/:category`

Get all products in a specific category.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `region` (string)

---

### 14. Get Products by Region
**GET** `/api/products/region/:region`

Get all products available in a specific region.

**Query Parameters:**
- `page`, `limit`, `search`, `category`, `brand`, `minPrice`, `maxPrice`, `status`

---

### 15. Add Regional Pricing
**POST** `/api/products/:productId/regional-pricing`

Add or update pricing for a specific region.

**Request Body:**
```json
{
  "region": "north",
  "currency": "INR",
  "regularPrice": 50000,
  "salePrice": 45000,
  "costPrice": 40000
}
```

---

### 16. Add Regional Availability
**POST** `/api/products/:productId/regional-availability`

Add or update availability for a specific region.

**Request Body:**
```json
{
  "region": "north",
  "stockQuantity": 100,
  "lowStockLevel": 10,
  "isAvailable": true
}
```

---

### 17. Add Regional SEO
**POST** `/api/products/:productId/regional-seo`

Add or update SEO for a specific region.

**Request Body:**
```json
{
  "region": "north",
  "metaTitle": "Product Title",
  "metaDescription": "Product Description",
  "keywords": ["keyword1", "keyword2"],
  "slug": "product-slug"
}
```

---

### 18. Add Related Products
**POST** `/api/products/:productId/related-products`

Add related products.

**Request Body:**
```json
{
  "relatedProducts": [
    {
      "productId": "PROD987654321",
      "relationType": "cross_sell"
    }
  ]
}
```

---

### 19. Mark as Popular/Best Seller/Trending
**POST** `/api/products/:productId/mark-popular`
**POST** `/api/products/:productId/mark-bestseller`
**POST** `/api/products/:productId/mark-trending`

Mark product as popular, best seller, or trending.

**Success Response:**
```json
{
  "success": true,
  "message": "Product marked as popular successfully"
}
```

---

### 20. Remove Popular/Best Seller/Trending Flag
**DELETE** `/api/products/:productId/remove-popular`
**DELETE** `/api/products/:productId/remove-bestseller`
**DELETE** `/api/products/:productId/remove-trending`

Remove the respective flags.

---

### 21. Get Featured Products
**GET** `/api/products/featured/all` - All featured products
**GET** `/api/products/featured/popular` - Most popular products
**GET** `/api/products/featured/best-sellers` - Best seller products
**GET** `/api/products/featured/trending` - Trending products

---

## Category APIs

### Base URL: `/api/categories`

### 1. Create Category
**POST** `/api/categories`

Create a new category or subcategory.

**Request Body:**
```json
{
  "name": "Electronics",  // Required - Must be unique
  "description": "Electronic items and gadgets",  // Optional
  "parentCategoryId": null,  // Optional - MongoDB ObjectID for subcategory
  "image": {
    "url": "https://example.com/category.jpg",
    "altText": "Electronics category"
  },
  "banner": {
    "url": "https://example.com/banner.jpg",
    "altText": "Electronics banner",
    "link": "https://example.com/promo"
  },
  "icon": "electronic-icon",  // Optional
  "displayOrder": 1,  // Optional - for sorting
  "showInMenu": true,  // Default: true
  "isActive": true,  // Default: true
  "isFeatured": false,  // Default: false
  "meta": {
    "title": "Electronics - Meta Title",
    "description": "Electronics meta description",
    "keywords": ["electronics", "gadgets"]
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "categoryId": "CAT123456789",  // Auto-generated
    "name": "Electronics",
    "slug": "electronics",  // Auto-generated from name
    "level": 0,  // Auto-calculated (0 for main, 1+ for sub)
    "path": [],  // Auto-calculated hierarchy path
    "_id": "507f1f77bcf86cd799439011"
  }
}
```

---

### 2. Get All Categories
**GET** `/api/categories`

Get all categories with optional filters.

**Query Parameters:**
- `parentCategoryId` (string) - Filter by parent (use 'null' for main categories)
- `isActive` (boolean, default: true) - Filter by active status

**Success Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "categoryId": "CAT123",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic items",
      "image": {},
      "banner": {},
      "parentCategoryId": null,
      "subCategories": [
        {
          "_id": "507f...",
          "categoryId": "CAT456",
          "name": "Mobile Phones",
          "slug": "mobile-phones"
        }
      ],
      "level": 0,
      "path": [],
      "isActive": true,
      "isFeatured": false,
      "displayOrder": 1,
      "meta": {},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Category by ID
**GET** `/api/categories/:categoryId`

Get single category with populated parent and subcategories.

**Success Response:**
```json
{
  "success": true,
  "data": {/* complete category object */}
}
```

---

### 4. Get Category with Subcategories
**GET** `/api/categories/:categoryId/with-subcategories`

Get category with all its subcategories expanded.

---

### 5. Get Categories for Dropdown
**GET** `/api/categories/dropdown/all`

Get all main categories with their active subcategories (optimized for dropdown menus).

**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "CAT123",
      "name": "Electronics",
      "slug": "electronics",
      "image": {},
      "subCategories": [
        {
          "categoryId": "CAT456",
          "name": "Mobile Phones",
          "slug": "mobile-phones"
        }
      ]
    }
  ]
}
```

---

### 6. Update Category
**PUT** `/api/categories/:categoryId`

Update existing category. All fields are optional.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "image": {},
  "banner": {},
  "meta": {},
  "displayOrder": 2,
  "isActive": true,
  "parentCategoryId": "507f..."  // Can change parent category
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {/* updated category */}
}
```

---

### 7. Delete Category
**DELETE** `/api/categories/:categoryId`

Delete a category.

**Query Parameters:**
- `force` (boolean, default: false) - Force delete with subcategories

**Note:** If category has subcategories and force=false, deletion will fail.

**Success Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error if has subcategories:**
```json
{
  "success": false,
  "message": "Category has 5 subcategories. Delete subcategories first or use force=true",
  "subcategoriesCount": 5
}
```

---

### 8. Update Category Image
**PUT** `/api/categories/:categoryId/image`

Upload and update category image. File is automatically uploaded to S3 and resized.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `image` (file, required) - Single image file
- `altText` (string, optional) - Alt text for the image

**Supported File Types:** JPEG, JPG, PNG, WebP
**Max File Size:** 10MB
**Auto-Processing:** Image is automatically resized (800px width) and converted to JPEG

**Example using Postman:**
1. Select PUT method
2. URL: `http://localhost:5000/api/categories/507f1f77bcf86cd799439011/image`
3. Body → form-data
4. Add key `image` (type: File) → select image file
5. Add key `altText` (type: Text) → "Electronics category" (optional)

**Success Response:**
```json
{
  "success": true,
  "message": "Category image uploaded and updated successfully",
  "data": {
    "categoryId": "507f1f77bcf86cd799439011",
    "image": {
      "url": "https://bucket.s3.region.amazonaws.com/categories/1234567-abc123.jpg",
      "altText": "Electronics category"
    }
  }
}
```

---

### 9. Update Category Banner
**PUT** `/api/categories/:categoryId/banner`

Upload and update category banner. File is automatically uploaded to S3 and resized.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `image` (file, required) - Single banner image file
- `altText` (string, optional) - Alt text for the banner
- `link` (string, optional) - URL link for banner click action

**Supported File Types:** JPEG, JPG, PNG, WebP
**Max File Size:** 10MB
**Auto-Processing:** Banner is automatically resized (1200px width) and converted to JPEG

**Example using Postman:**
1. Select PUT method
2. URL: `http://localhost:5000/api/categories/507f1f77bcf86cd799439011/banner`
3. Body → form-data
4. Add key `image` (type: File) → select banner image
5. Add key `altText` (type: Text) → "Sale banner" (optional)
6. Add key `link` (type: Text) → "https://example.com/sale" (optional)

**Success Response:**
```json
{
  "success": true,
  "message": "Category banner uploaded and updated successfully",
  "data": {
    "categoryId": "507f1f77bcf86cd799439011",
    "banner": {
      "url": "https://bucket.s3.region.amazonaws.com/categories/banners/1234567-abc123.jpg",
      "altText": "Sale banner",
      "link": "https://example.com/sale"
    }
  }
}
```

---

### 10. Update Category Meta/SEO
**PUT** `/api/categories/:categoryId/meta`

Update category SEO metadata.

**Request Body:**
```json
{
  "title": "Category Meta Title",
  "description": "Category meta description",
  "keywords": ["keyword1", "keyword2"]
}
```

---

### 11. Toggle Featured Status
**PUT** `/api/categories/:categoryId/toggle-featured`

Toggle category featured status (true/false).

**Success Response:**
```json
{
  "success": true,
  "message": "Category featured successfully",
  "data": {/* updated category */}
}
```

---

### 12. Get Category Stats
**GET** `/api/categories/stats`

Get category statistics.

**Success Response:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "active": 45,
    "inactive": 5,
    "featured": 10,
    "main": 15,
    "sub": 35,
    "byLevel": [
      { "_id": 0, "count": 15 },
      { "_id": 1, "count": 35 }
    ]
  }
}
```

---

### 13. Search Categories
**GET** `/api/categories/search/:query`

Search categories by name, description, or slug.

**Success Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [/* matching categories */]
}
```

---

### 14. Bulk Reorder Categories
**PUT** `/api/categories/bulk/reorder`

Update display order for multiple categories.

**Request Body:**
```json
{
  "categories": [
    { "id": "507f...", "displayOrder": 1 },
    { "id": "507f...", "displayOrder": 2 }
  ]
}
```

---

### 15. Get Featured Categories
**GET** `/api/categories/featured`

Get all featured and active categories.

**Success Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [/* featured categories */]
}
```

---

## Common Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {/* response data */}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message describing what went wrong"
}
```

---

## Error Handling

### Common HTTP Status Codes

- **200** - Success
- **201** - Created successfully
- **400** - Bad request (validation error, missing required fields)
- **404** - Resource not found
- **500** - Server error

### Common Error Messages

**Product Errors:**
- "Product ID or SKU already exists" (400)
- "Product not found" (404)
- "Each variant must include a price" (400)
- "Images array is required" (400)

**Category Errors:**
- "Category name is required" (400)
- "Category with this name already exists" (400)
- "Parent category not found" (404)
- "Category not found" (404)
- "A category cannot be its own parent" (400)
- "Category has X subcategories. Delete subcategories first or use force=true" (400)

---

## Important Notes

### For Products:

1. **Product ID**: Auto-generated if not provided (format: PRODXXXXXX)
2. **SKU**: Optional but recommended for inventory management
3. **Images**: Use image upload endpoints - files are automatically uploaded to S3, resized, and optimized
4. **Variants**: If `hasVariants: true`, variants array is required
5. **Regional Data**: Add regional pricing/availability/SEO as needed for different regions
6. **Payment Plans**: Admin-created investment plans for flexible payment options
7. **Stock Status**: Auto-calculated based on stockQuantity and lowStockLevel
8. **Final Price**: Auto-calculated (salePrice if available, else regularPrice)
9. **Image Upload**: Supports multipart/form-data with automatic S3 upload, resize (800px width for products), and JPEG conversion

### For Categories:

1. **Category ID**: Auto-generated (format: CATXXXXXX)
2. **Slug**: Auto-generated from name (lowercase, hyphenated)
3. **Level & Path**: Auto-calculated based on parent category
4. **Hierarchy**: Support for main categories and subcategories
5. **SubCategories**: Automatically managed when creating/updating categories
6. **Delete**: Cannot delete category with subcategories unless `force=true`
7. **Display Order**: Use for custom sorting in frontend
8. **Image Upload**: Supports multipart/form-data with automatic S3 upload, resize (800px width for images, 1200px for banners), and JPEG conversion

### Workflow Recommendations:

**Creating a Product:**
1. Create product with basic info (POST `/api/products`)
2. Upload product images using multipart/form-data (PUT `/api/products/:productId/images`) - S3 upload happens automatically
3. Add regional data if needed
4. Set featured flags if needed
5. Update status to 'published'

**Creating a Category:**
1. Create main category (POST `/api/categories`)
2. Upload category image using multipart/form-data (PUT `/api/categories/:categoryId/image`) - S3 upload happens automatically
3. Optionally upload category banner (PUT `/api/categories/:categoryId/banner`)
4. Create subcategories with parentCategoryId
5. Use in product creation

---

## Authentication

**Note:** Current routes don't require authentication, but you should implement authentication middleware for admin operations in production.

Recommended headers for future auth:
```
Authorization: Bearer <token>
```

---

## Base URL

Replace `BASE_URL` with your actual server URL:
```
Development: http://localhost:5000
Production: https://your-production-url.com
```

Full endpoint example:
```
POST http://localhost:5000/api/products
```

---

## Frontend Implementation Examples

### 1. Creating a Product (React/JavaScript)

```javascript
const createProduct = async (productData) => {
  try {
    const response = await fetch('http://localhost:5000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(productData)
    });

    const result = await response.json();

    if (result.success) {
      console.log('Product created:', result.data);
      return result.data;
    } else {
      console.error('Error:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Failed to create product:', error);
    throw error;
  }
};

// Usage
const newProduct = {
  name: "Samsung Galaxy S24",
  description: {
    short: "Latest Samsung flagship phone",
    long: "Detailed description here..."
  },
  category: {
    mainCategoryId: "507f1f77bcf86cd799439011",
    mainCategoryName: "Electronics"
  },
  brand: "Samsung",
  pricing: {
    regularPrice: 89999,
    salePrice: 79999,
    currency: "INR"
  },
  availability: {
    stockQuantity: 100
  },
  status: "published"
};

createProduct(newProduct);
```

---

### 2. Uploading Product Images (multipart/form-data)

```javascript
const uploadProductImages = async (productId, imageFiles) => {
  try {
    // Create FormData object
    const formData = new FormData();

    // Add multiple image files
    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    // Optional: Add alt text
    formData.append('altText', 'Product image');

    const response = await fetch(`http://localhost:5000/api/products/${productId}/images`, {
      method: 'PUT',
      // DO NOT set Content-Type header - browser will set it automatically with boundary
      // headers: { 'Content-Type': 'multipart/form-data' }, // ❌ Wrong!
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log('Images uploaded:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Failed to upload images:', error);
    throw error;
  }
};

// Usage with file input
const handleImageUpload = (event, productId) => {
  const files = Array.from(event.target.files);
  uploadProductImages(productId, files);
};
```

---

### 3. React Component Example - Complete Product Creation with Images

```jsx
import React, { useState } from 'react';

const ProductCreateForm = () => {
  const [productData, setProductData] = useState({
    name: '',
    description: { short: '', long: '' },
    category: { mainCategoryId: '', mainCategoryName: '' },
    brand: '',
    pricing: { regularPrice: 0, salePrice: 0, currency: 'INR' },
    availability: { stockQuantity: 0 },
    status: 'draft'
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Create product
      const createResponse = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.message);
      }

      const productId = createResult.data.productId;
      console.log('Product created:', productId);

      // Step 2: Upload images if selected
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach(file => {
          formData.append('images', file);
        });
        formData.append('altText', productData.name);

        const uploadResponse = await fetch(
          `http://localhost:5000/api/products/${productId}/images`,
          {
            method: 'PUT',
            body: formData
          }
        );

        const uploadResult = await uploadResponse.json();

        if (!uploadResult.success) {
          throw new Error(uploadResult.message);
        }

        console.log('Images uploaded:', uploadResult.data);
      }

      alert('Product created successfully!');
      // Reset form or redirect
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        placeholder="Product Name"
        value={productData.name}
        onChange={handleInputChange}
        required
      />

      <input
        type="number"
        name="pricing.regularPrice"
        placeholder="Regular Price"
        onChange={(e) => setProductData(prev => ({
          ...prev,
          pricing: { ...prev.pricing, regularPrice: parseFloat(e.target.value) }
        }))}
        required
      />

      <input
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleImageSelect}
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
};

export default ProductCreateForm;
```

---

### 4. Uploading Category Image

```javascript
const uploadCategoryImage = async (categoryId, imageFile) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile); // Note: 'image' (singular) for category
    formData.append('altText', 'Category image');

    const response = await fetch(
      `http://localhost:5000/api/categories/${categoryId}/image`,
      {
        method: 'PUT',
        body: formData
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('Category image uploaded:', result.data);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Failed to upload category image:', error);
    throw error;
  }
};

// Usage
const handleCategoryImageUpload = (event, categoryId) => {
  const file = event.target.files[0];
  if (file) {
    uploadCategoryImage(categoryId, file);
  }
};
```

---

### 5. Axios Example (Alternative to fetch)

```javascript
import axios from 'axios';

// Upload product images using Axios
const uploadProductImagesAxios = async (productId, imageFiles) => {
  try {
    const formData = new FormData();

    imageFiles.forEach(file => {
      formData.append('images', file);
    });
    formData.append('altText', 'Product image');

    const response = await axios.put(
      `http://localhost:5000/api/products/${productId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      }
    );

    console.log('Upload successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
};
```

---

### 6. Important Notes for Frontend Developers

**Image Upload Requirements:**
- **Max file size:** 10MB per file
- **Accepted formats:** JPEG, JPG, PNG, WebP
- **Product images:** Max 10 files at once (use field name `images`)
- **Category image/banner:** Single file only (use field name `image`)
- **Auto-processing:** Images are automatically resized and converted to JPEG on the server

**Common Mistakes to Avoid:**
```javascript
// ❌ Wrong - Don't set Content-Type for multipart/form-data with fetch
fetch(url, {
  headers: { 'Content-Type': 'multipart/form-data' },
  body: formData
});

// ✅ Correct - Let browser set Content-Type with boundary
fetch(url, {
  body: formData
});

// ❌ Wrong - Don't use 'images' for category (it expects 'image')
formData.append('images', categoryFile);

// ✅ Correct - Use 'image' for category
formData.append('image', categoryFile);
```

**Image Preview Before Upload:**
```javascript
const [imagePreviews, setImagePreviews] = useState([]);

const handleImagePreview = (e) => {
  const files = Array.from(e.target.files);

  const previews = files.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  });

  Promise.all(previews).then(setImagePreviews);
};

// In JSX
{imagePreviews.map((preview, index) => (
  <img key={index} src={preview} alt="Preview" style={{ width: 100 }} />
))}
```

---

## Support

For any issues or questions, contact the backend team.
