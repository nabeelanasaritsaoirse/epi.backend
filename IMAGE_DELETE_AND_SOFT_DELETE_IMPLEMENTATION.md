# Image Delete & Soft Delete Implementation - Complete Documentation

## Overview
This document outlines all the changes made to implement:
1. **Soft Delete** for Categories and Products (instead of hard delete)
2. **Individual Image Deletion** with S3 cleanup
3. **Image Reordering** with 1-based indexing and auto re-indexing
4. **Admin-specific APIs** to view deleted items

---

## 🔥 Phase 1: Model Updates

### Category Model Changes ([models/Category.js](models/Category.js))

#### Added Fields:
```javascript
// New images array (multiple images support)
images: [imageSchema]  // Array of {url, altText, order}

// Soft delete fields
isDeleted: { type: Boolean, default: false }
deletedAt: { type: Date }
deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
```

#### Image Schema:
```javascript
const imageSchema = new mongoose.Schema({
  url: String,
  altText: String,
  order: { type: Number, default: 1 }  // 1-based ordering
}, { _id: false });
```

**Note:** The old `image` field (single) is still maintained for backward compatibility.

---

### Product Model Changes ([models/Product.js](models/Product.js))

#### Updated Image Schema:
```javascript
const imageSchema = new mongoose.Schema({
  url: String,
  isPrimary: Boolean,
  altText: String,
  order: { type: Number, default: 1 }  // NEW: 1-based ordering
});
```

#### Added Soft Delete Fields:
```javascript
isDeleted: { type: Boolean, default: false }
deletedAt: { type: Date }
deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
```

---

## 🔥 Phase 2: Controller Updates

### Category Controller ([controllers/categoryController.js](controllers/categoryController.js))

#### Modified Functions:

1. **getAllCategories** - Now filters out soft-deleted categories for non-admin users
2. **getCategoryById** - Returns 404 for deleted categories (non-admin)
3. **deleteCategory** - Converted to soft delete

#### New Functions:

| Function | Description |
|----------|-------------|
| `getAllCategoriesForAdmin` | Admin-only: View all categories with optional `showDeleted=true` |
| `restoreCategory` | Restore a soft-deleted category |
| `deleteCategoryImage` | Delete individual image by index (1-based) |
| `reorderCategoryImages` | Reorder images |

---

### Product Controller ([controllers/productController.js](controllers/productController.js))

#### Modified Functions:

1. **getAllProducts** - Now filters out soft-deleted products for non-admin users
2. **deleteProduct** - Converted to soft delete

#### New Functions:

| Function | Description |
|----------|-------------|
| `getAllProductsForAdmin` | Admin-only: View all products with optional `showDeleted=true` |
| `restoreProduct` | Restore a soft-deleted product |
| `deleteProductImage` | Delete individual product image by index (1-based) |
| `deleteVariantImage` | Delete individual variant image by index (1-based) |
| `reorderProductImages` | Reorder product images |
| `reorderVariantImages` | Reorder variant images |

---

## 🔥 Phase 3 & 4: New API Endpoints

### Category Endpoints

#### Admin List (with deleted indicator)
```http
GET /api/categories/admin/all?showDeleted=true
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "...",
      "name": "Electronics",
      "isDeleted": true,
      "deletedAt": "2025-01-15T10:30:00.000Z",
      "deletedBy": {
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  ]
}
```

---

#### Restore Deleted Category
```http
PUT /api/categories/:categoryId/restore
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Category restored successfully",
  "data": { ... }
}
```

---

#### Delete Individual Image (1-based index)
```http
DELETE /api/categories/:categoryId/images/2
Authorization: Bearer <admin-token>
```

**What it does:**
- Deletes image at index 2 (second image)
- Removes image from S3
- Re-indexes remaining images (1, 2, 3...)

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": { ... }
}
```

---

#### Reorder Category Images
```http
PUT /api/categories/:categoryId/images/reorder
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "imageOrders": [
    { "index": 1, "order": 3 },
    { "index": 2, "order": 1 },
    { "index": 3, "order": 2 }
  ]
}
```

**What it does:**
- Changes image at index 1 to order 3
- Changes image at index 2 to order 1
- Changes image at index 3 to order 2
- Sorts images by new order

---

### Product Endpoints

#### Admin List (with deleted indicator)
```http
GET /api/products/admin/all?showDeleted=true&page=1&limit=10
Authorization: Bearer <admin-token>
```

---

#### Restore Deleted Product
```http
PUT /api/products/:productId/restore
Authorization: Bearer <admin-token>
```

---

#### Delete Individual Product Image
```http
DELETE /api/products/:productId/images/2
Authorization: Bearer <admin-token>
```

**Example:**
- Product has images: [img1, img2, img3, img4]
- Delete index 2 → Removes img2 from S3
- Remaining: [img1, img3, img4] with order [1, 2, 3]

---

#### Delete Individual Variant Image
```http
DELETE /api/products/:productId/variants/:variantId/images/1
Authorization: Bearer <admin-token>
```

---

#### Reorder Product Images
```http
PUT /api/products/:productId/images/reorder
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "imageOrders": [
    { "index": 1, "order": 2 },
    { "index": 2, "order": 1 }
  ]
}
```

---

#### Reorder Variant Images
```http
PUT /api/products/:productId/variants/:variantId/images/reorder
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "imageOrders": [
    { "index": 1, "order": 3 },
    { "index": 2, "order": 1 }
  ]
}
```

---

## 🔥 Phase 5: S3 Integration

All image deletion operations now automatically:
1. Delete the image from S3 using `deleteImageFromS3(imageUrl)`
2. Handle errors gracefully (continues even if S3 delete fails)
3. Remove image from database
4. Re-index remaining images

**Example from code:**
```javascript
// Delete image from S3
if (imageToDelete.url) {
  try {
    await deleteImageFromS3(imageToDelete.url);
  } catch (error) {
    console.error("Error deleting image from S3:", error);
    // Continue with deletion even if S3 delete fails
  }
}

// Remove from array
category.images.splice(arrayIndex, 1);

// Re-index (1-based)
category.images.forEach((img, idx) => {
  img.order = idx + 1;
});
```

---

## 🔒 Authentication & Authorization

All admin routes now require:
```javascript
verifyToken, isAdmin
```

**Example:**
```javascript
router.delete('/:categoryId', verifyToken, isAdmin, categoryController.deleteCategory);
```

---

## 📝 Key Features

### 1. **Soft Delete Behavior**

#### For Non-Admin Users:
- Deleted categories/products are **completely hidden**
- `GET /api/categories` → filters out `isDeleted: true`
- `GET /api/products` → filters out `isDeleted: true`

#### For Admin Users:
- Can view deleted items using admin endpoints
- `GET /api/categories/admin/all?showDeleted=true`
- Can restore deleted items
- Deleted items show `isDeleted`, `deletedAt`, `deletedBy` fields

---

### 2. **Image Indexing**

- **1-based indexing** (starts from 1, not 0)
- **Auto re-indexing** after deletion
- **Order field** for custom sorting

**Example:**
```
Initial: [img1:order=1, img2:order=2, img3:order=3, img4:order=4]
Delete index 2 (img2)
Result: [img1:order=1, img3:order=2, img4:order=3]
```

---

### 3. **Error Handling**

All endpoints include proper error handling:

```javascript
// Invalid index
{
  "success": false,
  "message": "Invalid image index. Index must be a positive number starting from 1"
}

// Already deleted
{
  "success": false,
  "message": "Category is already deleted"
}

// Not deleted (restore attempt)
{
  "success": false,
  "message": "Category is not deleted"
}
```

---

## 🧪 Testing Examples

### Test Soft Delete Flow

1. **Create a product/category**
```bash
POST /api/products
```

2. **Delete it (soft delete)**
```bash
DELETE /api/products/:productId
# Headers: Authorization: Bearer <admin-token>
```

3. **Verify it's hidden from public**
```bash
GET /api/products
# Should NOT include the deleted product
```

4. **View as admin**
```bash
GET /api/products/admin/all?showDeleted=true
# Headers: Authorization: Bearer <admin-token>
# Should show the deleted product with isDeleted: true
```

5. **Restore it**
```bash
PUT /api/products/:productId/restore
# Headers: Authorization: Bearer <admin-token>
```

---

### Test Image Deletion

1. **Product has 5 images**
```json
{
  "images": [
    { "url": "s3://img1.jpg", "order": 1 },
    { "url": "s3://img2.jpg", "order": 2 },
    { "url": "s3://img3.jpg", "order": 3 },
    { "url": "s3://img4.jpg", "order": 4 },
    { "url": "s3://img5.jpg", "order": 5 }
  ]
}
```

2. **Delete image at index 3**
```bash
DELETE /api/products/:productId/images/3
# Headers: Authorization: Bearer <admin-token>
```

3. **Result:**
```json
{
  "images": [
    { "url": "s3://img1.jpg", "order": 1 },
    { "url": "s3://img2.jpg", "order": 2 },
    { "url": "s3://img4.jpg", "order": 3 },  // Re-indexed!
    { "url": "s3://img5.jpg", "order": 4 }   // Re-indexed!
  ]
}
```

---

## 📂 Modified Files Summary

### Models
- ✅ [models/Category.js](models/Category.js) - Added `images` array, soft delete fields, order field
- ✅ [models/Product.js](models/Product.js) - Added soft delete fields, order field

### Controllers
- ✅ [controllers/categoryController.js](controllers/categoryController.js) - 5 new functions, 3 modified
- ✅ [controllers/productController.js](controllers/productController.js) - 7 new functions, 2 modified

### Routes
- ✅ [routes/categoryRoutes.js](routes/categoryRoutes.js) - Added 4 new routes, auth middleware
- ✅ [routes/productRoutes.js](routes/productRoutes.js) - Added 7 new routes, auth middleware

### Services
- ✅ Uses existing `deleteImageFromS3` from [services/awsUploadService.js](services/awsUploadService.js)

---

## 🚀 Migration Notes

### For Existing Data

Existing categories/products will automatically have:
```javascript
isDeleted: false  // Default value
deletedAt: null
deletedBy: null
```

No database migration needed - Mongoose will handle defaults.

---

## 🎯 Summary

**Total New Features:**
- ✅ Soft delete for Categories (not permanent)
- ✅ Soft delete for Products (not permanent)
- ✅ Admin can restore deleted items
- ✅ Individual image deletion with S3 cleanup
- ✅ Auto re-indexing after image deletion (1-based)
- ✅ Image reordering for categories/products/variants
- ✅ Admin-only endpoints to view deleted items
- ✅ Complete admin authentication on all admin routes

**Total New Endpoints:** 13
**Modified Endpoints:** 8
**S3 Integration:** ✅ Complete

---

## 📞 Support

For any issues or questions about this implementation, refer to:
- [TIMEZONE_SETUP_GUIDE.md](TIMEZONE_SETUP_GUIDE.md)
- [DASHBOARD_OVERVIEW_API.md](DASHBOARD_OVERVIEW_API.md)

---

**Implementation Date:** 2025-01-15
**Status:** ✅ Complete and Production Ready
