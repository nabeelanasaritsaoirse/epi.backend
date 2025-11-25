# Banner & Success Stories API - Admin Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Banner APIs](#banner-apis)
4. [Success Stories APIs](#success-stories-apis)
5. [Usage Examples](#usage-examples)

---

## Overview

This document provides complete API documentation for managing Banners and Success Stories in the EPI backend system. Both features support:
- Image upload to AWS S3
- Admin management (create, update, delete)
- Public endpoints for frontend
- Platform-specific content (web/mobile/both)
- Active/inactive status management

**Base URL:** `https://api.epielio.com`

---

## Authentication

All admin endpoints require authentication. Include the following header in your requests:

```
Authorization: Bearer <your-admin-token>
```

---

## Banner APIs

### 1. Create Banner (Admin)
**Endpoint:** `POST /api/banners`
**Auth:** Required (Admin only)
**Content-Type:** `multipart/form-data`

**Form Data Fields:**
- `image` (File, Required) - Banner image (JPEG/PNG/WEBP, max 10MB)
- `title` (String, Required) - Banner title
- `description` (String, Optional) - Banner description
- `altText` (String, Optional) - Alt text for image (defaults to title)
- `linkUrl` (String, Optional) - URL where banner should redirect
- `targetBlank` (Boolean, Optional) - Open link in new tab (default: false)
- `displayOrder` (Number, Optional) - Display order (default: 0)
- `platform` (String, Optional) - "web", "mobile", or "both" (default: "both")
- `startDate` (Date, Optional) - Banner start date (ISO format)
- `endDate` (Date, Optional) - Banner end date (ISO format)

**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "_id": "657abc...",
    "title": "Summer Sale",
    "imageUrl": "https://epi-backend.s3.amazonaws.com/banners/...",
    "isActive": true,
    ...
  }
}
```

---

### 2. Get All Banners (Admin)
**Endpoint:** `GET /api/banners/admin/all`
**Auth:** Required (Admin only)

**Query Parameters:**
- `isActive` (Boolean, Optional) - Filter by active status
- `platform` (String, Optional) - Filter by platform (web/mobile/both)
- `search` (String, Optional) - Search in title and description
- `page` (Number, Optional) - Page number (default: 1)
- `limit` (Number, Optional) - Items per page (default: 20)
- `sortBy` (String, Optional) - Sort field (default: "displayOrder")
- `sortOrder` (String, Optional) - "asc" or "desc" (default: "asc")

**Example:** `GET /api/banners/admin/all?isActive=true&page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

---

### 3. Get Active Banners (Public)
**Endpoint:** `GET /api/banners/public/active`
**Auth:** Not Required (Public endpoint)

**Query Parameters:**
- `platform` (String, Optional) - "web", "mobile", or "all" (default: "web")
- `page` (Number, Optional) - Page number (default: 1)
- `limit` (Number, Optional) - Items per page (default: 10)

**Example:** `GET /api/banners/public/active?platform=mobile&limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "657abc...",
      "title": "Summer Sale",
      "imageUrl": "https://...",
      "linkUrl": "https://...",
      "displayOrder": 1
    }
  ],
  "pagination": {...}
}
```

---

### 4. Get Single Banner
**Endpoint:** `GET /api/banners/:id`
**Auth:** Not Required

**Example:** `GET /api/banners/657abc123...`

---

### 5. Update Banner (Admin)
**Endpoint:** `PUT /api/banners/:id`
**Auth:** Required (Admin only)
**Content-Type:** `application/json`

**Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "altText": "Updated alt text",
  "linkUrl": "https://newlink.com",
  "targetBlank": true,
  "displayOrder": 5,
  "platform": "web",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z",
  "isActive": true
}
```

---

### 6. Replace Banner Image (Admin)
**Endpoint:** `PUT /api/banners/:id/image`
**Auth:** Required (Admin only)
**Content-Type:** `multipart/form-data`

**Form Data:**
- `image` (File, Required) - New banner image

**Note:** Old image will be automatically deleted from S3.

---

### 7. Toggle Banner Status (Admin)
**Endpoint:** `PATCH /api/banners/:id/toggle`
**Auth:** Required (Admin only)

**Effect:** Switches banner between active and inactive status.

---

### 8. Delete Banner (Admin)
**Endpoint:** `DELETE /api/banners/:id`
**Auth:** Required (Admin only)

**Note:** This is a soft delete. Banner can be restored later.

---

### 9. Permanently Delete Banner (Admin)
**Endpoint:** `DELETE /api/banners/:id/permanent`
**Auth:** Required (Admin only)

**Warning:** This permanently deletes the banner and its image from S3. Cannot be undone.

---

### 10. Restore Deleted Banner (Admin)
**Endpoint:** `POST /api/banners/:id/restore`
**Auth:** Required (Admin only)

---

### 11. Reorder Banners (Admin)
**Endpoint:** `POST /api/banners/reorder`
**Auth:** Required (Admin only)
**Content-Type:** `application/json`

**Body:**
```json
{
  "bannerOrders": [
    { "id": "657abc...", "displayOrder": 1 },
    { "id": "657def...", "displayOrder": 2 },
    { "id": "657ghi...", "displayOrder": 3 }
  ]
}
```

---

### 12. Track Banner Click
**Endpoint:** `POST /api/banners/:id/click`
**Auth:** Not Required

**Purpose:** Increments click count for analytics.

---

### 13. Get Banner Statistics (Admin)
**Endpoint:** `GET /api/banners/admin/stats`
**Auth:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "active": 15,
    "inactive": 10,
    "deleted": 5,
    "totalClicks": 1250,
    "totalImpressions": 45000
  }
}
```

---

## Success Stories APIs

### 1. Create Success Story (Admin)
**Endpoint:** `POST /api/success-stories`
**Auth:** Required (Admin only)
**Content-Type:** `multipart/form-data`

**Form Data Fields:**
- `image` (File, Required) - Success story image (JPEG/PNG/WEBP, max 10MB)
- `title` (String, Required) - Story title
- `description` (String, Optional) - Story description
- `altText` (String, Optional) - Alt text for image (defaults to title)
- `displayOrder` (Number, Optional) - Display order (default: 0)
- `platform` (String, Optional) - "web", "mobile", or "both" (default: "both")

**Response:**
```json
{
  "success": true,
  "message": "Success story created successfully",
  "data": {
    "_id": "657xyz...",
    "title": "Customer Success Story",
    "imageUrl": "https://epi-backend.s3.amazonaws.com/success-stories/...",
    "isActive": true,
    "views": 0,
    ...
  }
}
```

---

### 2. Get All Success Stories (Admin)
**Endpoint:** `GET /api/success-stories/admin/all`
**Auth:** Required (Admin only)

**Query Parameters:**
- `isActive` (Boolean, Optional) - Filter by active status
- `platform` (String, Optional) - Filter by platform
- `search` (String, Optional) - Search in title and description
- `page` (Number, Optional) - Page number (default: 1)
- `limit` (Number, Optional) - Items per page (default: 20)
- `sortBy` (String, Optional) - Sort field (default: "displayOrder")
- `sortOrder` (String, Optional) - "asc" or "desc" (default: "asc")

**Example:** `GET /api/success-stories/admin/all?isActive=true&page=1`

---

### 3. Get Active Success Stories (Public)
**Endpoint:** `GET /api/success-stories/public/active`
**Auth:** Not Required (Public endpoint)

**Query Parameters:**
- `platform` (String, Optional) - "web", "mobile", or "all" (default: "web")
- `page` (Number, Optional) - Page number (default: 1)
- `limit` (Number, Optional) - Items per page (default: 10)

**Example:** `GET /api/success-stories/public/active?platform=mobile&limit=5`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "657xyz...",
      "title": "Customer Success",
      "description": "Amazing story...",
      "imageUrl": "https://...",
      "displayOrder": 1,
      "views": 150
    }
  ],
  "pagination": {...}
}
```

---

### 4. Get Single Success Story
**Endpoint:** `GET /api/success-stories/:id`
**Auth:** Not Required

**Note:** View count is automatically incremented when this endpoint is called.

**Example:** `GET /api/success-stories/657xyz123...`

---

### 5. Update Success Story (Admin)
**Endpoint:** `PUT /api/success-stories/:id`
**Auth:** Required (Admin only)
**Content-Type:** `application/json`

**Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "altText": "Updated alt text",
  "displayOrder": 5,
  "platform": "web",
  "isActive": true
}
```

---

### 6. Replace Success Story Image (Admin)
**Endpoint:** `PUT /api/success-stories/:id/image`
**Auth:** Required (Admin only)
**Content-Type:** `multipart/form-data`

**Form Data:**
- `image` (File, Required) - New success story image

**Note:** Old image will be automatically deleted from S3.

---

### 7. Toggle Success Story Status (Admin)
**Endpoint:** `PATCH /api/success-stories/:id/toggle`
**Auth:** Required (Admin only)

---

### 8. Delete Success Story (Admin)
**Endpoint:** `DELETE /api/success-stories/:id`
**Auth:** Required (Admin only)

**Note:** Soft delete - can be restored.

---

### 9. Permanently Delete Success Story (Admin)
**Endpoint:** `DELETE /api/success-stories/:id/permanent`
**Auth:** Required (Admin only)

**Warning:** Permanent deletion - cannot be undone.

---

### 10. Restore Deleted Success Story (Admin)
**Endpoint:** `POST /api/success-stories/:id/restore`
**Auth:** Required (Admin only)

---

### 11. Reorder Success Stories (Admin)
**Endpoint:** `POST /api/success-stories/reorder`
**Auth:** Required (Admin only)
**Content-Type:** `application/json`

**Body:**
```json
{
  "storyOrders": [
    { "id": "657xyz...", "displayOrder": 1 },
    { "id": "657abc...", "displayOrder": 2 },
    { "id": "657def...", "displayOrder": 3 }
  ]
}
```

---

### 12. Get Success Story Statistics (Admin)
**Endpoint:** `GET /api/success-stories/admin/stats`
**Auth:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 30,
    "active": 20,
    "inactive": 10,
    "deleted": 3,
    "totalViews": 5000
  }
}
```

---

## Usage Examples

### Example 1: Creating a Banner with cURL

```bash
curl -X POST https://api.epielio.com/api/banners \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "image=@/path/to/banner.jpg" \
  -F "title=Summer Sale 2025" \
  -F "description=Get 50% off on all products" \
  -F "linkUrl=https://epielio.com/sale" \
  -F "targetBlank=true" \
  -F "platform=both" \
  -F "displayOrder=1"
```

---

### Example 2: Creating a Banner with JavaScript (Fetch)

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('title', 'Summer Sale 2025');
formData.append('description', 'Get 50% off on all products');
formData.append('linkUrl', 'https://epielio.com/sale');
formData.append('targetBlank', 'true');
formData.append('platform', 'both');
formData.append('displayOrder', '1');

const response = await fetch('https://api.epielio.com/api/banners', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN'
  },
  body: formData
});

const result = await response.json();
console.log(result);
```

---

### Example 3: Fetching Active Banners (Frontend)

```javascript
const response = await fetch('https://api.epielio.com/api/banners/public/active?platform=web&limit=5');
const result = await response.json();

result.data.forEach(banner => {
  console.log(banner.title, banner.imageUrl);
});
```

---

### Example 4: Creating a Success Story with Axios

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const formData = new FormData();
formData.append('image', fs.createReadStream('/path/to/story.jpg'));
formData.append('title', 'Amazing Customer Transformation');
formData.append('description', 'This customer achieved incredible results...');
formData.append('platform', 'both');
formData.append('displayOrder', '1');

const response = await axios.post('https://api.epielio.com/api/success-stories', formData, {
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
    ...formData.getHeaders()
  }
});

console.log(response.data);
```

---

### Example 5: Update Banner Status

```javascript
// Toggle banner status
const response = await fetch('https://api.epielio.com/api/banners/657abc123/toggle', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN'
  }
});

const result = await response.json();
console.log(result.message); // "Banner activated successfully" or "Banner deactivated successfully"
```

---

### Example 6: Reorder Banners

```javascript
const bannerOrders = [
  { id: '657abc123', displayOrder: 1 },
  { id: '657def456', displayOrder: 2 },
  { id: '657ghi789', displayOrder: 3 }
];

const response = await fetch('https://api.epielio.com/api/banners/reorder', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ bannerOrders })
});

const result = await response.json();
console.log(result.message); // "Banners reordered successfully"
```

---

## Important Notes

### Image Processing
- All uploaded images are automatically resized to 1200px width (maintaining aspect ratio)
- Images are converted to JPEG format with 90% quality
- Maximum file size: 10MB
- Supported formats: JPEG, JPG, PNG, WEBP

### S3 Storage
- Banner images are stored in: `banners/` folder
- Success story images are stored in: `success-stories/` folder
- Images are automatically deleted from S3 when permanently deleted from database

### Platform Types
- `web` - Display only on web platform
- `mobile` - Display only on mobile apps
- `both` - Display on all platforms

### Soft Delete vs Permanent Delete
- **Soft Delete:** Banner/Story is hidden but can be restored
- **Permanent Delete:** Banner/Story and its S3 image are permanently removed

### Date Filters for Banners
- Banners can have `startDate` and `endDate`
- Public API automatically filters banners based on current date
- If no dates are set, banner is always shown (when active)

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created successfully
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (not admin)
- `404` - Not found
- `500` - Internal server error

---

## Support

For questions or issues, please contact the development team or raise an issue in the project repository.

**API Base URL:** https://api.epielio.com
**Documentation Version:** 1.0
**Last Updated:** 2025-01-24
