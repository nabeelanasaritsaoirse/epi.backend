# 📚 Complete API Documentation — Categories & Products (with Variants)

## Table of Contents
1. [Setup & Authentication](#setup--authentication)
2. [Category Endpoints](#category-endpoints)
3. [Product Endpoints](#product-endpoints)
4. [Testing Guide](#testing-guide)
5. [Frontend Integration](#frontend-integration)
6. [Error Handling](#error-handling)

---

## Setup & Authentication

### Base URL
```
http://localhost:3000/api
```

### Authentication Headers
For admin-protected endpoints, include:
```
Authorization: Bearer <JWT_TOKEN>
```

### Content-Type
```
Content-Type: application/json
```

---

## Category Endpoints

### 1. Get Categories for Dropdown (Public)
**Endpoint:** `GET /categories/dropdown/all`  
**Auth:** Not required  
**Purpose:** Fetch all active main categories with subcategories for form dropdowns

**cURL:**
```bash
curl -X GET http://localhost:3000/api/categories/dropdown/all
```

**Response (Success 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "categoryId": "CAT000001001",
      "name": "Electronics",
      "slug": "electronics",
      "image": {
        "url": "https://example.com/electronics.jpg",
        "altText": "Electronics"
      },
      "subCategories": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "categoryId": "CAT000001002",
          "name": "Mobile Phones",
          "slug": "mobile-phones"
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "categoryId": "CAT000001003",
          "name": "Laptops",
          "slug": "laptops"
        }
      ]
    }
  ]
}
```

---

### 2. Get All Categories (Public)
**Endpoint:** `GET /categories?parentCategoryId=null&isActive=true`  
**Auth:** Not required  
**Query Params:**
- `parentCategoryId` (optional): Filter by parent, or 'null' for main categories
- `isActive` (optional): 'true', 'false', or 'all'

**cURL:**
```bash
curl -X GET "http://localhost:3000/api/categories?parentCategoryId=null&isActive=true"
```

---

### 3. Get Category by ID (Public)
**Endpoint:** `GET /categories/:categoryId`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET http://localhost:3000/api/categories/507f1f77bcf86cd799439011
```

---

### 4. Get Category with Subcategories (Public)
**Endpoint:** `GET /categories/:categoryId/with-subcategories`  
**Auth:** Not required  
**Purpose:** Returns nested subcategories under a main category

**cURL:**
```bash
curl -X GET http://localhost:3000/api/categories/507f1f77bcf86cd799439011/with-subcategories
```

---

### 5. Search Categories (Public)
**Endpoint:** `GET /categories/search/:query`  
**Auth:** Not required  
**Purpose:** Full-text search on name, description, slug

**cURL:**
```bash
curl -X GET http://localhost:3000/api/categories/search/mobile
```

---

### 6. Create Category (Admin Only)
**Endpoint:** `POST /categories`  
**Auth:** Required (isAdmin)  
**Purpose:** Create main category or subcategory

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "All electronic products",
  "displayOrder": 1,
  "parentCategoryId": null,
  "image": {
    "url": "https://example.com/electronics.jpg",
    "altText": "Electronics Category"
  },
  "meta": {
    "title": "Electronics Store",
    "description": "Browse electronics",
    "keywords": ["electronics", "gadgets"]
  }
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "All electronic products",
    "displayOrder": 1
  }'
```

**Response (Success 201):**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "categoryId": "CAT000001001",
    "name": "Electronics",
    "slug": "electronics",
    "description": "All electronic products",
    "displayOrder": 1,
    "subCategories": [],
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 7. Create Subcategory (Admin Only)
**Endpoint:** `POST /categories`  
**Auth:** Required (isAdmin)

**Request Body:**
```json
{
  "name": "Mobile Phones",
  "description": "All mobile phones",
  "parentCategoryId": "507f1f77bcf86cd799439011",
  "displayOrder": 1
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Mobile Phones",
    "parentCategoryId": "507f1f77bcf86cd799439011",
    "displayOrder": 1
  }'
```

---

### 8. Update Category (Admin Only)
**Endpoint:** `PUT /categories/:categoryId`  
**Auth:** Required (isAdmin)

**Request Body (partial update):**
```json
{
  "name": "Electronics & Gadgets",
  "displayOrder": 2,
  "isActive": true
}
```

**cURL:**
```bash
curl -X PUT http://localhost:3000/api/categories/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name": "Electronics & Gadgets", "displayOrder": 2}'
```

---

### 9. Delete Category (Admin Only)
**Endpoint:** `DELETE /categories/:categoryId`  
**Auth:** Required (isAdmin)  
**Query Params:** `force=true` (to delete with subcategories)

**cURL (safe delete — fails if has subcategories):**
```bash
curl -X DELETE http://localhost:3000/api/categories/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**cURL (force delete including subcategories):**
```bash
curl -X DELETE "http://localhost:3000/api/categories/507f1f77bcf86cd799439011?force=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### 10. Bulk Reorder Categories (Admin Only)
**Endpoint:** `PUT /categories/bulk/reorder`  
**Auth:** Required (isAdmin)

**Request Body:**
```json
{
  "categories": [
    { "id": "507f1f77bcf86cd799439011", "displayOrder": 1 },
    { "id": "507f1f77bcf86cd799439012", "displayOrder": 2 },
    { "id": "507f1f77bcf86cd799439013", "displayOrder": 3 }
  ]
}
```

**cURL:**
```bash
curl -X PUT http://localhost:3000/api/categories/bulk/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "categories": [
      { "id": "507f1f77bcf86cd799439011", "displayOrder": 1 },
      { "id": "507f1f77bcf86cd799439012", "displayOrder": 2 }
    ]
  }'
```

---

## Product Endpoints

### 1. Create Product (with Variants)
**Endpoint:** `POST /products`  
**Auth:** Not required  
**Purpose:** Create product with optional variants (color, size, price, installments, etc.)

**Request Body (without variants):**
```json
{
  "name": "iPhone 14",
  "description": {
    "short": "Latest Apple smartphone",
    "long": "High-performance smartphone with advanced features"
  },
  "brand": "Apple",
  "sku": "SKU-001",
  "category": {
    "mainCategoryId": "507f1f77bcf86cd799439011",
    "mainCategoryName": "Electronics",
    "subCategoryId": "507f1f77bcf86cd799439012",
    "subCategoryName": "Mobile Phones"
  },
  "pricing": {
    "regularPrice": 999.99,
    "salePrice": 899.99
  },
  "availability": {
    "stockQuantity": 50,
    "lowStockLevel": 10
  },
  "status": "published"
}
```

**Request Body (with variants):**
```json
{
  "name": "iPhone 14",
  "description": {
    "short": "Latest Apple smartphone"
  },
  "brand": "Apple",
  "category": {
    "mainCategoryId": "507f1f77bcf86cd799439011",
    "mainCategoryName": "Electronics",
    "subCategoryId": "507f1f77bcf86cd799439012",
    "subCategoryName": "Mobile Phones"
  },
  "pricing": {
    "regularPrice": 999.99
  },
  "hasVariants": true,
  "variants": [
    {
      "attributes": {
        "color": "Black",
        "material": "Aluminum"
      },
      "price": 999.99,
      "salePrice": 899.99,
      "stock": 20,
      "description": {
        "short": "Black iPhone 14"
      },
      "paymentPlan": {
        "enabled": true,
        "minDownPayment": 100,
        "maxDownPayment": 500,
        "minInstallmentDays": 30,
        "maxInstallmentDays": 365,
        "interestRate": 0
      },
      "images": [
        {
          "url": "https://example.com/iphone-black-1.jpg",
          "isPrimary": true,
          "altText": "Black iPhone 14"
        }
      ]
    },
    {
      "attributes": {
        "color": "Gold",
        "material": "Stainless Steel"
      },
      "price": 1049.99,
      "salePrice": 949.99,
      "stock": 15,
      "description": {
        "short": "Gold iPhone 14"
      },
      "paymentPlan": {
        "enabled": true,
        "minDownPayment": 150,
        "minInstallmentDays": 30,
        "maxInstallmentDays": 365
      }
    }
  ],
  "status": "published"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 14",
    "description": {"short": "Apple smartphone"},
    "brand": "Apple",
    "pricing": {"regularPrice": 999.99},
    "category": {
      "mainCategoryId": "507f1f77bcf86cd799439011",
      "mainCategoryName": "Electronics"
    },
    "hasVariants": true,
    "variants": [
      {
        "attributes": {"color": "Black"},
        "price": 999.99,
        "stock": 20
      }
    ]
  }'
```

**Response (Success 201):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "productId": "PROD123456001",
    "name": "iPhone 14",
    "sku": "SKU-001"
  }
}
```

---

### 2. Get All Products (with Filters)
**Endpoint:** `GET /products?page=1&limit=10&search=&category=&brand=&status=published&region=global`  
**Auth:** Not required  
**Query Params:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (search in name, description)
- `category` (filter by main category)
- `brand` (filter by brand)
- `status` (draft, published, archived)
- `region` (global, or specific region)

**cURL:**
```bash
curl -X GET "http://localhost:3000/api/products?page=1&limit=10&search=iPhone"
```

**Response (Success 200):**
```json
{
  "success": true,
  "data": [
    {
      "productId": "PROD123456001",
      "name": "iPhone 14",
      "brand": "Apple",
      "category": {
        "mainCategoryId": "507f...",
        "mainCategoryName": "Electronics",
        "subCategoryId": "507f...",
        "subCategoryName": "Mobile Phones"
      },
      "pricing": {
        "regularPrice": 999.99,
        "salePrice": 899.99,
        "finalPrice": 899.99
      },
      "hasVariants": true,
      "variants": [
        {
          "variantId": "VAR123456",
          "sku": "PROD123456001-1-3456",
          "attributes": { "color": "Black" },
          "price": 999.99,
          "salePrice": 899.99,
          "paymentPlan": { "enabled": true, ... },
          "stock": 20
        }
      ]
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3. Get Product by ID
**Endpoint:** `GET /products/:productId`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET http://localhost:3000/api/products/PROD123456001
```

**Response includes variants if hasVariants=true**

---

### 4. Get Product Statistics
**Endpoint:** `GET /products/stats?region=global`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET http://localhost:3000/api/products/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProducts": 150,
    "inStockProducts": 120,
    "lowStockProducts": 15,
    "outOfStockProducts": 15
  }
}
```

---

### 5. Search Products Advanced
**Endpoint:** `GET /products/search?q=iPhone&category=Electronics&minPrice=500&maxPrice=1200`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET "http://localhost:3000/api/products/search?q=iPhone&category=Electronics"
```

---

### 6. Get Low Stock Products
**Endpoint:** `GET /products/low-stock?region=global`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET http://localhost:3000/api/products/low-stock
```

---

### 7. Get Products by Category
**Endpoint:** `GET /products/category/:category?page=1&limit=10`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET "http://localhost:3000/api/products/category/Electronics?page=1&limit=10"
```

---

### 8. Get Products by Region
**Endpoint:** `GET /products/region/:region?page=1&limit=10&search=&minPrice=&maxPrice=`  
**Auth:** Not required

**cURL:**
```bash
curl -X GET "http://localhost:3000/api/products/region/US?page=1&limit=10"
```

---

### 9. Update Product (including Variants)
**Endpoint:** `PUT /products/:productId`  
**Auth:** Not required

**Request Body (update with new variants):**
```json
{
  "name": "iPhone 14 Pro",
  "pricing": {
    "regularPrice": 1099.99,
    "salePrice": 999.99
  },
  "hasVariants": true,
  "variants": [
    {
      "attributes": { "color": "Deep Purple" },
      "price": 1099.99,
      "stock": 25
    }
  ]
}
```

**cURL:**
```bash
curl -X PUT http://localhost:3000/api/products/PROD123456001 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 14 Pro",
    "pricing": {"regularPrice": 1099.99}
  }'
```

---

### 10. Delete Product
**Endpoint:** `DELETE /products/:productId`  
**Auth:** Not required

**cURL:**
```bash
curl -X DELETE http://localhost:3000/api/products/PROD123456001
```

---

### 11. Add Regional Pricing
**Endpoint:** `POST /products/:productId/regional-pricing`  
**Auth:** Not required

**Request Body:**
```json
{
  "region": "US",
  "currency": "USD",
  "regularPrice": 999.99,
  "salePrice": 899.99,
  "costPrice": 500
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/products/PROD123456001/regional-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "region": "US",
    "currency": "USD",
    "regularPrice": 999.99,
    "salePrice": 899.99
  }'
```

---

### 12. Add Regional Availability
**Endpoint:** `POST /products/:productId/regional-availability`  
**Auth:** Not required

**Request Body:**
```json
{
  "region": "US",
  "stockQuantity": 50,
  "lowStockLevel": 10,
  "isAvailable": true
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/api/products/PROD123456001/regional-availability \
  -H "Content-Type: application/json" \
  -d '{
    "region": "US",
    "stockQuantity": 50,
    "isAvailable": true
  }'
```

---

### 13. Add Regional SEO
**Endpoint:** `POST /products/:productId/regional-seo`  
**Auth:** Not required

**Request Body:**
```json
{
  "region": "US",
  "metaTitle": "Buy iPhone 14 in US",
  "metaDescription": "Get the latest iPhone 14 delivered in US",
  "keywords": ["iPhone", "Apple", "smartphone"],
  "slug": "iphone-14-us"
}
```

---

### 14. Add Related Products
**Endpoint:** `POST /products/:productId/related-products`  
**Auth:** Not required

**Request Body:**
```json
{
  "productId": "PROD123456002",
  "relationType": "cross_sell"
}
```

Valid relationTypes: `cross_sell`, `up_sell`, `complementary`, `similar`

---

## Testing Guide

### Using cURL

Test the category dropdown (public, no auth):
```bash
curl -X GET http://localhost:3000/api/categories/dropdown/all
```

Create a category (requires admin token):
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"Test Category"}'
```

Create a product with variants:
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Product",
    "brand":"TestBrand",
    "description":{"short":"A test product"},
    "pricing":{"regularPrice":99.99},
    "category":{"mainCategoryId":"YOUR_CAT_ID","mainCategoryName":"Electronics"},
    "hasVariants":true,
    "variants":[
      {"attributes":{"color":"Red"},"price":99.99,"stock":10},
      {"attributes":{"color":"Blue"},"price":109.99,"stock":5}
    ]
  }'
```

### Using Postman

1. Import the collection: `scripts/category-api.postman_collection.json`
2. Set environment variables:
   - `baseUrl`: http://localhost:3000
   - `adminToken`: Your JWT token
3. Run the requests

### Using the Test HTML Page

Open `test-admin-single-page.html` in your browser:
1. Set API Base URL to `http://localhost:3000`
2. Paste your admin JWT token
3. Create categories, then create products with variants
4. View responses in the output pane

---

## Frontend Integration

### React — Category Dropdown in Product Form

```javascript
import React, { useState, useEffect } from 'react';

function ProductForm() {
  const [categories, setCategories] = useState([]);
  const [selectedMainCat, setSelectedMainCat] = useState('');
  const [selectedSubCat, setSelectedSubCat] = useState('');
  const [variants, setVariants] = useState([]);

  // Load categories on mount
  useEffect(() => {
    fetch('/api/categories/dropdown/all')
      .then(r => r.json())
      .then(data => setCategories(data.data || []))
      .catch(err => console.error('Error loading categories:', err));
  }, []);

  // Get subcategories of selected main category
  const getSubcategories = () => {
    const mainCat = categories.find(c => c._id === selectedMainCat);
    return mainCat?.subCategories || [];
  };

  // Handle main category change
  const handleMainCatChange = (e) => {
    setSelectedMainCat(e.target.value);
    setSelectedSubCat(''); // Reset subcategory
  };

  // Add variant field
  const addVariant = () => {
    setVariants([...variants, {
      attributes: { color: '', size: '' },
      price: 0,
      stock: 0
    }]);
  };

  // Update variant
  const updateVariant = (idx, field, value) => {
    const updated = [...variants];
    updated[idx][field] = value;
    setVariants(updated);
  };

  // Submit product
  const handleSubmit = async (e) => {
    e.preventDefault();

    const mainCat = categories.find(c => c._id === selectedMainCat);
    const subCat = getSubcategories().find(c => c._id === selectedSubCat);

    const payload = {
      name: document.getElementById('prodName').value,
      brand: document.getElementById('prodBrand').value,
      description: { short: document.getElementById('prodDesc').value },
      pricing: {
        regularPrice: parseFloat(document.getElementById('prodPrice').value),
        salePrice: parseFloat(document.getElementById('prodSalePrice').value || 0)
      },
      category: {
        mainCategoryId: mainCat._id,
        mainCategoryName: mainCat.name,
        subCategoryId: subCat?._id,
        subCategoryName: subCat?.name
      },
      hasVariants: variants.length > 0,
      variants: variants.length > 0 ? variants : undefined,
      status: 'published'
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        alert('Product created successfully!');
        // Reset form
      } else {
        alert('Error: ' + result.message);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const subcats = getSubcategories();

  return (
    <form onSubmit={handleSubmit}>
      <h2>Add Product</h2>

      {/* Basic Fields */}
      <input id="prodName" type="text" placeholder="Product Name" required />
      <input id="prodBrand" type="text" placeholder="Brand" required />
      <input id="prodDesc" type="text" placeholder="Description" required />
      <input id="prodPrice" type="number" step="0.01" placeholder="Regular Price" required />
      <input id="prodSalePrice" type="number" step="0.01" placeholder="Sale Price (optional)" />

      {/* Category Dropdown */}
      <select value={selectedMainCat} onChange={handleMainCatChange} required>
        <option value="">-- Select Main Category --</option>
        {categories.map(cat => (
          <option key={cat._id} value={cat._id}>{cat.name}</option>
        ))}
      </select>

      {/* Subcategory Dropdown */}
      {selectedMainCat && subcats.length > 0 && (
        <select value={selectedSubCat} onChange={(e) => setSelectedSubCat(e.target.value)}>
          <option value="">-- Select Subcategory (optional) --</option>
          {subcats.map(sub => (
            <option key={sub._id} value={sub._id}>{sub.name}</option>
          ))}
        </select>
      )}

      {/* Variants Section */}
      <div>
        <h3>Variants</h3>
        {variants.map((v, idx) => (
          <div key={idx} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Color"
              value={v.attributes.color || ''}
              onChange={(e) => updateVariant(idx, 'attributes', { ...v.attributes, color: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={v.price}
              onChange={(e) => updateVariant(idx, 'price', parseFloat(e.target.value))}
            />
            <input
              type="number"
              placeholder="Stock"
              value={v.stock}
              onChange={(e) => updateVariant(idx, 'stock', parseInt(e.target.value))}
            />
          </div>
        ))}
        <button type="button" onClick={addVariant}>Add Variant</button>
      </div>

      <button type="submit">Create Product</button>
    </form>
  );
}

export default ProductForm;
```

---

### Vue 3 — Category Dropdown

```vue
<template>
  <div>
    <h2>Add Product</h2>
    <form @submit.prevent="submitProduct">
      <div>
        <label>Main Category:</label>
        <select v-model="selectedMainCat" required>
          <option value="">-- Select Main Category --</option>
          <option v-for="cat in categories" :key="cat._id" :value="cat._id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <div v-if="getSubcategories().length > 0">
        <label>Sub Category:</label>
        <select v-model="selectedSubCat">
          <option value="">-- Select Subcategory --</option>
          <option v-for="sub in getSubcategories()" :key="sub._id" :value="sub._id">
            {{ sub.name }}
          </option>
        </select>
      </div>

      <div>
        <label>Product Name:</label>
        <input v-model="form.name" type="text" required />
      </div>

      <div>
        <label>Brand:</label>
        <input v-model="form.brand" type="text" required />
      </div>

      <div>
        <label>Price:</label>
        <input v-model.number="form.price" type="number" step="0.01" required />
      </div>

      <button type="submit">Create Product</button>
    </form>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';

export default {
  setup() {
    const categories = ref([]);
    const selectedMainCat = ref('');
    const selectedSubCat = ref('');
    const form = ref({
      name: '',
      brand: '',
      price: 0,
      variants: []
    });

    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories/dropdown/all');
        const data = await res.json();
        categories.value = data.data || [];
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };

    const getSubcategories = () => {
      const mainCat = categories.value.find(c => c._id === selectedMainCat.value);
      return mainCat?.subCategories || [];
    };

    const submitProduct = async () => {
      const mainCat = categories.value.find(c => c._id === selectedMainCat.value);
      const subCat = getSubcategories().find(c => c._id === selectedSubCat.value);

      const payload = {
        name: form.value.name,
        brand: form.value.brand,
        pricing: { regularPrice: form.value.price },
        category: {
          mainCategoryId: mainCat._id,
          mainCategoryName: mainCat.name,
          subCategoryId: subCat?._id,
          subCategoryName: subCat?.name
        },
        description: { short: '' }
      };

      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
          alert('Product created!');
          form.value = { name: '', brand: '', price: 0, variants: [] };
        }
      } catch (err) {
        console.error('Submit error:', err);
      }
    };

    onMounted(() => {
      loadCategories();
    });

    return {
      categories,
      selectedMainCat,
      selectedSubCat,
      form,
      getSubcategories,
      submitProduct
    };
  }
};
</script>
```

---

### Vanilla JavaScript — Category Dropdown

```javascript
class ProductFormManager {
  constructor() {
    this.categories = [];
    this.selectedMainCat = '';
    this.selectedSubCat = '';
  }

  async init() {
    await this.loadCategories();
    this.attachEventListeners();
  }

  async loadCategories() {
    try {
      const res = await fetch('/api/categories/dropdown/all');
      const data = await res.json();
      this.categories = data.data || [];
      this.populateMainCategoryDropdown();
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  populateMainCategoryDropdown() {
    const select = document.getElementById('mainCategory');
    select.innerHTML = '<option value="">-- Select Main Category --</option>';

    this.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat._id;
      option.textContent = cat.name;
      option.dataset.catName = cat.name;
      select.appendChild(option);
    });
  }

  populateSubCategoryDropdown() {
    const mainSelect = document.getElementById('mainCategory');
    const subSelect = document.getElementById('subCategory');
    const selectedId = mainSelect.value;

    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';

    if (!selectedId) {
      subSelect.disabled = true;
      return;
    }

    const mainCat = this.categories.find(c => c._id === selectedId);
    if (mainCat && mainCat.subCategories && mainCat.subCategories.length > 0) {
      subSelect.disabled = false;
      mainCat.subCategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub._id;
        option.textContent = sub.name;
        option.dataset.subName = sub.name;
        subSelect.appendChild(option);
      });
    } else {
      subSelect.disabled = true;
    }
  }

  attachEventListeners() {
    document.getElementById('mainCategory').addEventListener('change', () => {
      this.populateSubCategoryDropdown();
    });

    document.getElementById('submitBtn').addEventListener('click', () => {
      this.submitProduct();
    });
  }

  async submitProduct() {
    const mainSelect = document.getElementById('mainCategory');
    const subSelect = document.getElementById('subCategory');
    const mainCatId = mainSelect.value;
    const subCatId = subSelect.value;

    if (!mainCatId) {
      alert('Please select a main category');
      return;
    }

    const mainCat = this.categories.find(c => c._id === mainCatId);
    const subCat = mainCat.subCategories?.find(c => c._id === subCatId);

    const payload = {
      name: document.getElementById('prodName').value,
      brand: document.getElementById('prodBrand').value,
      description: { short: document.getElementById('prodDesc').value },
      pricing: {
        regularPrice: parseFloat(document.getElementById('prodPrice').value)
      },
      category: {
        mainCategoryId: mainCat._id,
        mainCategoryName: mainCat.name,
        subCategoryId: subCat?._id,
        subCategoryName: subCat?.name
      },
      status: 'published'
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        alert('Product created successfully!');
      } else {
        alert('Error: ' + result.message);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Error creating product');
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const manager = new ProductFormManager();
  manager.init();
});
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Category name is required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Product not found"
}
```

#### 500 Server Error
```json
{
  "success": false,
  "message": "Internal server error message"
}
```

### Error Handling in Frontend

```javascript
async function createProduct(payload) {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      console.error('API Error:', data.message);
      // Show error to user
      return null;
    }

    return data.data;
  } catch (err) {
    console.error('Network Error:', err);
    // Show network error to user
    return null;
  }
}
```

---

## Quick Start Checklist

- [ ] Ensure MongoDB is running (`brew services start mongodb-community` or `docker run mongo`)
- [ ] Start backend server (`npm run dev`)
- [ ] Open `test-admin-single-page.html` to test endpoints
- [ ] Create categories first (use admin token)
- [ ] Create products with categories and variants
- [ ] Integrate frontend code (React/Vue/Vanilla JS) into your app
- [ ] Test product creation, listing, and fetching with variants

---

## File Locations

- **Test HTML:** `/test-admin-single-page.html`
- **Category Routes:** `/routes/categoryRoutes.js`
- **Product Routes:** `/routes/productRoutes.js`
- **Category Controller:** `/controllers/categoryController.js`
- **Product Controller:** `/controllers/productController.js`
- **Product Model:** `/models/Product.js`
- **Category Model:** `/models/Category.js`

---

## Next Steps

1. Test all endpoints using the test HTML page or cURL
2. Create categories for your store
3. Create products with variants
4. Integrate the frontend code into your app
5. Deploy to production

---

**Documentation Generated:** November 12, 2025  
**Status:** Production Ready ✅
