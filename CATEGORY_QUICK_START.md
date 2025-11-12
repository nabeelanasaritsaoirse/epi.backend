# Category Management - Quick Start Guide

## What's New? 🎉

You now have a complete **Category Management System** with hierarchical categories and subcategories. This allows you to:

- ✅ Create main categories and subcategories
- ✅ Display categories in product creation dropdown
- ✅ Fetch subcategories based on selected main category
- ✅ Update and delete categories
- ✅ Control category display order
- ✅ Manage category metadata (SEO, images, etc.)

---

## Files Created

### 1. **Models**
- `models/Category.js` - Category database schema with hierarchical structure

### 2. **Controllers**
- `controllers/categoryController.js` - All category business logic and API handlers

### 3. **Routes**
- `routes/categoryRoutes.js` - Category API endpoints

### 4. **Documentation**
- `CATEGORY_API.md` - Complete API documentation with examples
- `CATEGORY_FRONTEND_INTEGRATION.js` - Frontend integration code (React, Vanilla JS, HTML)
- `CATEGORY_QUICK_START.md` - This file

### 5. **Testing**
- `scripts/test-categories.sh` - Bash script to test all endpoints

---

## Product Model Update

The Product model has been updated to reference categories:

```javascript
category: {
  mainCategoryId: ObjectId (ref to Category),
  mainCategoryName: String,
  subCategoryId: ObjectId (ref to Category),
  subCategoryName: String
}
```

This replaces the old string-based `category.main` and `category.sub`.

---

## Quick API Examples

### 1. Get Categories for Product Dropdown
```bash
curl http://localhost:3000/api/categories/dropdown/all
```
**Response:** All active main categories with their subcategories

---

### 2. Create Main Category (Admin)
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "All electronic products",
    "displayOrder": 1
  }'
```

---

### 3. Create Subcategory (Admin)
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Mobile Phones",
    "parentCategoryId": "PARENT_CATEGORY_ID",
    "displayOrder": 1
  }'
```

---

### 4. Update Category (Admin)
```bash
curl -X PUT http://localhost:3000/api/categories/CATEGORY_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Electronics & Gadgets",
    "displayOrder": 2
  }'
```

---

### 5. Delete Category (Admin)
```bash
# Delete only if no subcategories
curl -X DELETE http://localhost:3000/api/categories/CATEGORY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Force delete including all subcategories
curl -X DELETE "http://localhost:3000/api/categories/CATEGORY_ID?force=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Admin Routes Added

All admin category routes require `verifyToken` and `isAdmin` middleware:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:categoryId` | Update category |
| DELETE | `/api/categories/:categoryId` | Delete category |
| PUT | `/api/categories/bulk/reorder` | Reorder categories |

---

## Public Routes (No Auth Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/categories/dropdown/all` | Get main categories with subcategories |
| GET | `/api/categories` | Get all categories with filters |
| GET | `/api/categories/:categoryId` | Get single category |
| GET | `/api/categories/:categoryId/with-subcategories` | Get category with nested subcategories |
| GET | `/api/categories/search/:query` | Search categories |

---

## Frontend Integration Steps

### Step 1: Load Categories in Product Form
```javascript
async function loadCategories() {
  const response = await fetch('/api/categories/dropdown/all');
  const data = await response.json();
  return data.data; // Array of main categories with subCategories
}
```

### Step 2: Populate Main Category Dropdown
```javascript
const categories = await loadCategories();

const select = document.getElementById('mainCategory');
categories.forEach(category => {
  const option = document.createElement('option');
  option.value = category._id;
  option.textContent = category.name;
  select.appendChild(option);
});
```

### Step 3: Handle Subcategory Dropdown Changes
```javascript
document.getElementById('mainCategory').addEventListener('change', (e) => {
  const selected = e.target.value;
  const category = categories.find(cat => cat._id === selected);
  
  const subSelect = document.getElementById('subCategory');
  subSelect.innerHTML = '<option value="">-- Select Sub Category --</option>';
  
  if (category?.subCategories?.length > 0) {
    subSelect.disabled = false;
    category.subCategories.forEach(subcat => {
      const option = document.createElement('option');
      option.value = subcat._id;
      option.textContent = subcat.name;
      subSelect.appendChild(option);
    });
  } else {
    subSelect.disabled = true;
  }
});
```

### Step 4: Submit Product with Categories
```javascript
const formData = {
  name: "iPhone 14",
  category: {
    mainCategoryId: document.getElementById('mainCategory').value,
    mainCategoryName: "Electronics",
    subCategoryId: document.getElementById('subCategory').value,
    subCategoryName: "Mobile Phones"
  },
  // ... other fields
};

const response = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(formData)
});
```

---

## Testing

### Run Automated Tests
```bash
chmod +x scripts/test-categories.sh
bash scripts/test-categories.sh
```

Make sure to set the `TOKEN` variable in the script with your actual admin token.

---

## Migration Guide (If You Have Existing Products)

If you have existing products with old category format:

```javascript
// Old format
{
  category: {
    main: "Electronics",
    sub: "Mobile Phones"
  }
}

// New format
{
  category: {
    mainCategoryId: ObjectId,
    mainCategoryName: "Electronics",
    subCategoryId: ObjectId,
    subCategoryName: "Mobile Phones"
  }
}
```

You'll need to:
1. Create categories in the database
2. Update existing products to reference the new category ObjectIds

---

## Database Indexes

The Category model has these indexes for performance:
- `{ name: 1, parentCategoryId: 1 }`
- `{ slug: 1 }`

---

## Key Features

### Auto-Generated Fields
- `categoryId` - Unique identifier (format: CAT[timestamp][random])
- `slug` - Auto-generated from name, used for URLs
- `createdAt` / `updatedAt` - Timestamps

### Hierarchical Structure
- Main categories have `parentCategoryId: null`
- Subcategories have `parentCategoryId` pointing to parent
- Parent categories maintain `subCategories` array

### SEO Support
- Meta title, description, and keywords
- Slugs for URL-friendly names
- Image URLs and alt text for categories

### Active Status
- Categories can be marked inactive
- Inactive categories won't appear in dropdowns
- Use `isActive: false` to hide from customers

### Display Order
- Control the order categories appear in lists
- Use bulk reorder endpoint to update multiple at once

---

## Common Errors & Solutions

### Error: "Category with this name already exists"
- Category names are unique
- Solution: Use a different name or check existing categories

### Error: "Category has X subcategories"
- Can't delete main category if it has subcategories
- Solution: Delete subcategories first or use `force=true` parameter

### Error: "A category cannot be its own parent"
- You tried to set a category as its own parent
- Solution: Choose a different parent category

### Error: "Parent category not found"
- The parentCategoryId you provided doesn't exist
- Solution: Verify the parent category ID exists

---

## Best Practices

1. **Category Naming**
   - Use clear, descriptive names
   - Use title case (e.g., "Mobile Phones" not "mobile phones")
   - Keep names concise

2. **Organization**
   - Limit to 2 levels (main + sub)
   - Avoid deeply nested categories
   - Group similar items

3. **Display Order**
   - Keep display orders sequential (1, 2, 3...)
   - Use bulk reorder for consistency
   - Update order when adding new categories

4. **SEO Metadata**
   - Always set meta title and description
   - Add relevant keywords
   - Keep under 160 characters for descriptions

5. **Images**
   - Use consistent dimensions
   - Include meaningful alt text
   - Optimize for web

---

## Next Steps

1. ✅ Create main categories (Electronics, Clothing, Books, etc.)
2. ✅ Add subcategories under each main category
3. ✅ Update your product creation form to use category dropdown
4. ✅ Migrate existing products to reference new categories
5. ✅ Test the complete workflow

---

## Support Files

- **API Reference:** `CATEGORY_API.md`
- **Frontend Code:** `CATEGORY_FRONTEND_INTEGRATION.js`
- **Test Script:** `scripts/test-categories.sh`

---

## Questions?

Refer to the detailed `CATEGORY_API.md` for:
- Complete endpoint documentation
- Request/response examples
- Error handling
- Database schema details

Good luck! 🚀
