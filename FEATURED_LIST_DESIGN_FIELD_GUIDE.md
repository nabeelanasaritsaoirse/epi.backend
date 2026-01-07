# Featured List Design Field - Admin Guide

## Overview

A new `design` field has been added to the Featured List system, giving administrators full control over how each featured list appears on the frontend. Instead of hardcoding different layouts, admins can now select from 5 different design options (1, 2, 3, 4, 5) for each list.

---

## What's New?

### Design Field
- **Type**: Number (Integer)
- **Allowed Values**: 1, 2, 3, 4, 5
- **Default Value**: 1
- **Purpose**: Controls the visual layout/design of the featured list on the mobile app

### Design Options
The design number corresponds to different UI layouts that the frontend team will implement:

| Design Value | Layout Type | Description |
|--------------|-------------|-------------|
| **1** | Grid Layout | Default grid view (good for general products) |
| **2** | Carousel | Horizontal scrolling carousel |
| **3** | List View | Vertical list with larger product cards |
| **4** | Featured Cards | Highlighted cards with special styling |
| **5** | Custom Layout | Special layout for promotional content |

> **Note**: The frontend team decides the actual visual implementation. These are suggested layouts.

---

## How to Use

### Creating a New Featured List with Design

**Endpoint**: `POST {{BASEURL}}/api/featured-lists/admin/lists`

**Headers**:
```
Authorization: Bearer <your_admin_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "listName": "Best Sellers",
  "slug": "best-sellers",
  "description": "Our top selling products this month",
  "design": 3,
  "displayOrder": 1,
  "isActive": true
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Featured list created successfully",
  "data": {
    "listId": "abc-123-xyz",
    "listName": "Best Sellers",
    "slug": "best-sellers",
    "description": "Our top selling products this month",
    "design": 3,
    "displayOrder": 1,
    "isActive": true,
    "products": [],
    "createdBy": "...",
    "createdByEmail": "admin@example.com",
    "createdAt": "2026-01-06T10:30:00.000Z"
  }
}
```

---

### Updating the Design of an Existing List

**Endpoint**: `PUT {{BASEURL}}/api/featured-lists/admin/lists/:listId`

You can update just the design field without changing other properties.

**Request Body** (Update design only):
```json
{
  "design": 5
}
```

**Request Body** (Update multiple fields):
```json
{
  "listName": "Updated Name",
  "design": 4,
  "isActive": true
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "List updated successfully",
  "data": {
    "listId": "abc-123-xyz",
    "listName": "Updated Name",
    "slug": "best-sellers",
    "design": 4,
    "displayOrder": 1,
    "isActive": true,
    "products": [...],
    "updatedBy": "...",
    "updatedByEmail": "admin@example.com",
    "updatedAt": "2026-01-06T11:00:00.000Z"
  }
}
```

---

## Frontend Integration

### Public API Endpoints

The `design` field is automatically included in all public API responses:

#### Get All Featured Lists
**Endpoint**: `GET {{BASEURL}}/api/featured-lists/?page=1&limit=10`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "listId": "abc-123",
      "listName": "Best Sellers",
      "slug": "best-sellers",
      "description": "Top selling products",
      "displayOrder": 1,
      "design": 3,
      "products": [...],
      "totalProducts": 25
    },
    {
      "listId": "xyz-456",
      "listName": "New Arrivals",
      "slug": "new-arrivals",
      "description": "Latest products",
      "displayOrder": 2,
      "design": 2,
      "products": [...],
      "totalProducts": 15
    }
  ],
  "region": "global"
}
```

#### Get Single Featured List by Slug
**Endpoint**: `GET {{BASEURL}}/api/featured-lists/:slug?page=1&limit=10`

**Example**: `GET {{BASEURL}}/api/featured-lists/best-sellers?page=1&limit=10`

**Response**:
```json
{
  "success": true,
  "data": {
    "listId": "abc-123",
    "listName": "Best Sellers",
    "slug": "best-sellers",
    "description": "Top selling products",
    "design": 3,
    "products": [
      {
        "productId": "prod-001",
        "productName": "Product 1",
        "brand": "Brand A",
        "productImage": "https://...",
        "price": 100,
        "finalPrice": 80,
        "order": 1
      }
    ]
  },
  "pagination": {
    "current": 1,
    "pages": 3,
    "total": 25
  },
  "region": "global"
}
```

---

## Validation Rules

### Valid Design Values
- ✅ **1, 2, 3, 4, 5** (Accepted)
- ❌ **0, 6, 7, -1** (Rejected - out of range)
- ❌ **1.5, 2.7** (Rejected - must be integer)
- ❌ **"3"** (Rejected - must be number, not string)

### Error Examples

**Invalid Design Value** (Design = 0):
```json
{
  "success": false,
  "message": "design must be an integer between 1 and 5"
}
```

**Invalid Design Type** (Design = "3"):
```json
{
  "success": false,
  "message": "design must be an integer between 1 and 5"
}
```

**Invalid Design (Decimal)** (Design = 2.5):
```json
{
  "success": false,
  "message": "design must be an integer between 1 and 5"
}
```

---

## Use Cases & Recommendations

### When to Use Each Design

| Design | Best For | Example Lists |
|--------|----------|---------------|
| **1** | General products, default view | "Popular Products", "All Items" |
| **2** | Products that benefit from quick browsing | "Daily Deals", "Flash Sale" |
| **3** | Detailed product information needed | "Premium Collection", "Electronics" |
| **4** | Highlighting special/featured items | "Editor's Choice", "Staff Picks" |
| **5** | Seasonal or promotional content | "Holiday Special", "Limited Edition" |

### Tips for Admins

1. **Test Different Designs**: Try different designs to see which works best for your content
2. **Consistency**: Use similar designs for similar types of lists
3. **User Experience**: Consider mobile screen size when choosing layouts
4. **Update Anytime**: You can change the design at any time without affecting products
5. **Default is Safe**: If unsure, design 1 (grid layout) is always a safe choice

---

## Admin Panel Workflow

### Step-by-Step: Creating a Featured List with Design

1. **Login** to admin panel
2. Navigate to **Featured Lists** section
3. Click **"Create New List"**
4. Fill in the form:
   - **List Name**: Enter descriptive name
   - **Slug**: URL-friendly identifier (auto-generated or manual)
   - **Description**: Brief description of the list
   - **Design**: Select number 1-5 from dropdown
   - **Display Order**: Position in homepage (lower = higher priority)
   - **Is Active**: Enable/disable the list
5. Click **"Save"**
6. Add products to the list
7. **Preview** on mobile app

### Step-by-Step: Changing Design of Existing List

1. **Login** to admin panel
2. Navigate to **Featured Lists** section
3. Find the list you want to update
4. Click **"Edit"**
5. Change **Design** field to desired value (1-5)
6. Click **"Update"**
7. **Preview** changes on mobile app

---

## Technical Details

### Database Schema
```javascript
{
  design: {
    type: Number,
    required: true,
    default: 1,
    min: [1, "Design must be at least 1"],
    max: [5, "Design cannot exceed 5"],
    validate: {
      validator: Number.isInteger,
      message: "Design must be an integer"
    }
  }
}
```

### Backward Compatibility
- All **existing featured lists** will automatically have `design: 1` (default)
- No manual migration needed
- Existing lists will continue to work without any changes

---

## API Reference Summary

### Admin Endpoints

| Method | Endpoint | Design Field | Required |
|--------|----------|--------------|----------|
| POST | `/api/featured-lists/admin/lists` | Create with design | No (defaults to 1) |
| GET | `/api/featured-lists/admin/lists` | Returns design | N/A |
| GET | `/api/featured-lists/admin/lists/:listId` | Returns design | N/A |
| PUT | `/api/featured-lists/admin/lists/:listId` | Update design | No |
| DELETE | `/api/featured-lists/admin/lists/:listId` | N/A | N/A |

### Public Endpoints

| Method | Endpoint | Design Field Included |
|--------|----------|----------------------|
| GET | `/api/featured-lists/` | ✅ Yes |
| GET | `/api/featured-lists/:slug` | ✅ Yes |

---

## FAQ

### Q1: What happens to existing featured lists?
**A**: All existing lists automatically get `design: 1` (default grid layout). They will continue to work exactly as before.

### Q2: Can I change the design after creating a list?
**A**: Yes! You can update the design at any time using the update endpoint.

### Q3: What if I don't specify a design when creating a list?
**A**: The system automatically uses `design: 1` as default.

### Q4: Can I use the same design for multiple lists?
**A**: Absolutely! Multiple lists can have the same design value.

### Q5: Will changing design affect my products?
**A**: No, changing the design only affects the visual layout. Your products remain unchanged.

### Q6: Can I add more design options (6, 7, 8)?
**A**: Currently limited to 1-5. Contact the development team if you need more options.

### Q7: Is the design field required?
**A**: No, it's optional. If not provided, it defaults to 1.

---

## Frontend Developer Notes

### Mobile App Integration

The frontend team should:

1. **Read the design field** from API response
2. **Render different layouts** based on design value
3. **Handle all 5 design types** (1, 2, 3, 4, 5)
4. **Fallback to design 1** if unknown value received

**Example Frontend Code (React Native)**:
```javascript
const renderFeaturedList = (list) => {
  switch(list.design) {
    case 1:
      return <GridLayout products={list.products} />;
    case 2:
      return <CarouselLayout products={list.products} />;
    case 3:
      return <ListLayout products={list.products} />;
    case 4:
      return <FeaturedCardsLayout products={list.products} />;
    case 5:
      return <CustomLayout products={list.products} />;
    default:
      return <GridLayout products={list.products} />; // Fallback
  }
};
```

---

## Support

If you encounter any issues or need help:

1. Check this documentation first
2. Verify your design value is between 1-5
3. Check API response for error messages
4. Contact the development team with:
   - List ID or slug
   - Design value you tried to use
   - Full error message

---

## Changelog

### Version 1.0 (2026-01-06)
- ✅ Added `design` field to Featured List model
- ✅ Updated create endpoint to accept design parameter
- ✅ Updated update endpoint to allow design modification
- ✅ Added design field to all public API responses
- ✅ Implemented validation (1-5, integers only)
- ✅ Set default value to 1 for backward compatibility

---

## Summary

The design field gives you **complete control** over how featured lists appear on the mobile app:

✅ **No hardcoding** - Change designs anytime
✅ **5 layout options** - Choose what fits best
✅ **Easy to use** - Just set a number (1-5)
✅ **Fully validated** - System prevents invalid values
✅ **Backward compatible** - Existing lists work automatically
✅ **Frontend ready** - Already included in API responses

**Start using it today** by adding the `design` field when creating or updating featured lists!
