# Banner & Success Story API Documentation

## Overview

Two complete endpoints for managing banners and success stories:
- **Banners**: Photo uploads to AWS S3 with database references (CRUD operations)
- **Success Stories**: Text-only content with optional fields (CRUD operations)

---

## BANNER ENDPOINTS

### 1. Create Banner
**POST** `/api/banners`

**Authentication:** Admin Required (Bearer Token)

**Content-Type:** `multipart/form-data`

**Request Body:**
```
{
  "image": <File>,              // Required - Image file (jpeg, jpg, png, webp)
  "title": "string",             // Required - Banner title
  "description": "string",       // Optional - Banner description
  "altText": "string",           // Optional - Alt text for accessibility
  "linkUrl": "string",           // Optional - URL to redirect on click
  "targetBlank": "true|false",   // Optional - Open link in new tab
  "displayOrder": "number",      // Optional - Order of display (default: 0)
  "platform": "web|app|both",    // Optional - Target platform (default: both)
  "startDate": "ISO-date",       // Optional - Banner active from
  "endDate": "ISO-date"          // Optional - Banner active until
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "_id": "banner_id",
    "title": "Banner Title",
    "imageUrl": "https://s3.../banner.jpg",
    "imageKey": "banners/timestamp.jpg",
    "displayOrder": 0,
    "isActive": true,
    "createdAt": "2025-11-13T00:00:00Z"
  }
}
```

---

### 2. Get All Active Banners (Public)
**GET** `/api/banners/public/active`

**Authentication:** None Required

**Query Parameters:**
```
?platform=web      // Filter by platform (web, app, both, all)
&page=1            // Page number (default: 1)
&limit=10          // Results per page (default: 10)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "banner_id",
      "title": "Banner Title",
      "imageUrl": "https://s3.../banner.jpg",
      "altText": "Alt Text",
      "linkUrl": "https://example.com",
      "targetBlank": false,
      "displayOrder": 0,
      "imageWidth": 1200,
      "imageHeight": 600,
      "platform": "web"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

---

### 3. Get All Banners (Admin)
**GET** `/api/banners/admin/all`

**Authentication:** Admin Required

**Query Parameters:**
```
?isActive=true              // Filter active/inactive
&platform=web              // Filter by platform
&search=banner             // Search in title/description
&page=1                    // Page number
&limit=20                  // Results per page
&sortBy=displayOrder       // Sort field
&sortOrder=asc|desc        // Sort direction
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

---

### 4. Get Banner by ID
**GET** `/api/banners/:id`

**Authentication:** None Required

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "banner_id",
    "title": "Banner Title",
    "description": "Description",
    "imageUrl": "https://s3.../banner.jpg",
    "altText": "Alt Text",
    "linkUrl": "https://example.com",
    "displayOrder": 0,
    "isActive": true,
    "platform": "web",
    "startDate": "2025-11-01T00:00:00Z",
    "endDate": "2025-12-01T00:00:00Z",
    "clickCount": 42,
    "createdBy": { "name": "Admin", "email": "admin@example.com" },
    "createdAt": "2025-11-13T00:00:00Z"
  }
}
```

---

### 5. Update Banner (Metadata)
**PUT** `/api/banners/:id`

**Authentication:** Admin Required

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "altText": "string",
  "linkUrl": "string",
  "targetBlank": boolean,
  "displayOrder": number,
  "platform": "web|app|both",
  "startDate": "ISO-date",
  "endDate": "ISO-date",
  "isActive": boolean
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner updated successfully",
  "data": { ...updated banner... }
}
```

---

### 6. Replace Banner Image
**PUT** `/api/banners/:id/image`

**Authentication:** Admin Required

**Content-Type:** `multipart/form-data`

**Request Body:**
```
{
  "image": <File>    // Required - New image file
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner image replaced successfully",
  "data": { ...updated banner... }
}
```

---

### 7. Toggle Banner Status
**PATCH** `/api/banners/:id/toggle`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Banner activated successfully",
  "data": { ...updated banner... }
}
```

---

### 8. Soft Delete Banner
**DELETE** `/api/banners/:id`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Banner soft deleted successfully"
}
```

---

### 9. Permanently Delete Banner
**DELETE** `/api/banners/:id/permanent`

**Authentication:** Admin Required

**Note:** Deletes from both database and S3

**Response:**
```json
{
  "success": true,
  "message": "Banner permanently deleted successfully"
}
```

---

### 10. Restore Banner
**POST** `/api/banners/:id/restore`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Banner restored successfully",
  "data": { ...restored banner... }
}
```

---

### 11. Reorder Banners
**POST** `/api/banners/reorder`

**Authentication:** Admin Required

**Request Body:**
```json
{
  "bannerOrders": [
    { "id": "banner_id_1", "displayOrder": 1 },
    { "id": "banner_id_2", "displayOrder": 2 },
    { "id": "banner_id_3", "displayOrder": 3 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banners reordered successfully"
}
```

---

### 12. Track Banner Click
**POST** `/api/banners/:id/click`

**Authentication:** None Required

**Response:**
```json
{
  "success": true,
  "message": "Click tracked",
  "data": { "clickCount": 43 }
}
```

---

### 13. Get Banner Statistics
**GET** `/api/banners/admin/stats`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "active": 8,
    "inactive": 2,
    "deleted": 1,
    "totalClicks": 150,
    "totalImpressions": 5000
  }
}
```

---

## SUCCESS STORY ENDPOINTS

### 1. Create Success Story
**POST** `/api/success-stories`

**Authentication:** Admin Required

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "title": "string",                    // Required - Story title
  "textContent": "string",              // Required - Story text content
  "description": "string",              // Optional - Short description
  "shortDescription": "string",         // Optional - Very short summary
  "customerName": "string",             // Optional - Customer name
  "customerRole": "string",             // Optional - Customer role/title
  "displayOrder": number,               // Optional - Order (default: 0)
  "platform": "web|app|both",          // Optional - Platform (default: both)
  "rating": number                      // Optional - Rating 0-5 (default: 5)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Success story created successfully",
  "data": {
    "_id": "story_id",
    "title": "Story Title",
    "textContent": "Long story text...",
    "customerName": "John Doe",
    "rating": 5,
    "displayOrder": 0,
    "isActive": true,
    "views": 0,
    "likes": 0,
    "shares": 0,
    "createdAt": "2025-11-13T00:00:00Z"
  }
}
```

---

### 2. Get All Active Success Stories (Public)
**GET** `/api/success-stories/public/active`

**Authentication:** None Required

**Query Parameters:**
```
?platform=web      // Filter by platform
&page=1            // Page number
&limit=10          // Results per page
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "story_id",
      "title": "Story Title",
      "textContent": "Story content...",
      "shortDescription": "Summary",
      "customerName": "John Doe",
      "customerRole": "CEO",
      "rating": 5,
      "displayOrder": 0,
      "platform": "web",
      "views": 100,
      "likes": 25,
      "shares": 10
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
}
```

---

### 3. Get All Success Stories (Admin)
**GET** `/api/success-stories/admin/all`

**Authentication:** Admin Required

**Query Parameters:**
```
?isActive=true       // Filter active/inactive
&platform=web       // Filter by platform
&search=john        // Search in title/customer/content
&page=1             // Page number
&limit=20           // Results per page
&sortBy=displayOrder // Sort field
&sortOrder=asc|desc  // Sort direction
```

---

### 4. Get Success Story by ID
**GET** `/api/success-stories/:id`

**Authentication:** None Required

**Note:** Increments view count automatically

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "story_id",
    "title": "Story Title",
    "textContent": "Story content...",
    "rating": 5,
    "views": 101,
    "likes": 25,
    "shares": 10,
    "createdBy": { "name": "Admin", "email": "admin@example.com" },
    "createdAt": "2025-11-13T00:00:00Z"
  }
}
```

---

### 5. Update Success Story
**PUT** `/api/success-stories/:id`

**Authentication:** Admin Required

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "textContent": "string",
  "shortDescription": "string",
  "customerName": "string",
  "customerRole": "string",
  "displayOrder": number,
  "platform": "web|app|both",
  "rating": number,
  "isActive": boolean
}
```

**Response:**
```json
{
  "success": true,
  "message": "Success story updated successfully",
  "data": { ...updated story... }
}
```

---

### 6. Toggle Success Story Status
**PATCH** `/api/success-stories/:id/toggle`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Success story activated successfully",
  "data": { ...updated story... }
}
```

---

### 7. Soft Delete Success Story
**DELETE** `/api/success-stories/:id`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Success story soft deleted successfully"
}
```

---

### 8. Permanently Delete Success Story
**DELETE** `/api/success-stories/:id/permanent`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Success story permanently deleted successfully"
}
```

---

### 9. Restore Success Story
**POST** `/api/success-stories/:id/restore`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "message": "Success story restored successfully",
  "data": { ...restored story... }
}
```

---

### 10. Reorder Success Stories
**POST** `/api/success-stories/reorder`

**Authentication:** Admin Required

**Request Body:**
```json
{
  "storyOrders": [
    { "id": "story_id_1", "displayOrder": 1 },
    { "id": "story_id_2", "displayOrder": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Success stories reordered successfully"
}
```

---

### 11. Update Engagement Metrics
**PATCH** `/api/success-stories/:id/engagement`

**Authentication:** None Required

**Request Body:**
```json
{
  "action": "like|share"  // Required - like or share
}
```

**Response:**
```json
{
  "success": true,
  "message": "like recorded",
  "data": {
    "likes": 26,
    "shares": 10,
    "views": 101
  }
}
```

---

### 12. Get Success Story Statistics
**GET** `/api/success-stories/admin/stats`

**Authentication:** Admin Required

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 20,
    "active": 18,
    "inactive": 2,
    "deleted": 0,
    "totalViews": 5000,
    "totalLikes": 500,
    "totalShares": 150,
    "avgRating": "4.85"
  }
}
```

---

## EXAMPLE USAGE

### Using cURL

**Create Banner:**
```bash
curl -X POST http://localhost:3000/api/banners \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "title=Homepage Banner" \
  -F "description=Banner for homepage" \
  -F "platform=web" \
  -F "displayOrder=1"
```

**Get Active Banners:**
```bash
curl http://localhost:3000/api/banners/public/active?platform=web&limit=5
```

**Create Success Story:**
```bash
curl -X POST http://localhost:3000/api/success-stories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Amazing Success",
    "textContent": "This is a great success story...",
    "customerName": "John Doe",
    "rating": 5
  }'
```

**Get Active Success Stories:**
```bash
curl http://localhost:3000/api/success-stories/public/active?limit=10
```

---

## DATABASE SCHEMA

### Banner Model
- `title` - Banner title (required)
- `description` - Long description
- `imageUrl` - S3 URL (required)
- `imageKey` - S3 key path (required)
- `altText` - Accessibility text
- `imageWidth`, `imageHeight` - Image dimensions
- `imageSize` - File size in bytes
- `linkUrl` - Optional redirect URL
- `targetBlank` - Open in new tab flag
- `displayOrder` - Ordering priority
- `isActive` - Active/inactive status
- `platform` - web/app/both
- `startDate`, `endDate` - Date range
- `clickCount` - Click tracker
- `impressions` - View counter
- `createdBy`, `updatedBy`, `deletedBy` - User references
- `isDeleted` - Soft delete flag

### SuccessStory Model
- `title` - Story title (required)
- `textContent` - Story content (required)
- `description` - Short description
- `shortDescription` - Very short summary
- `customerName` - Customer name
- `customerRole` - Customer role
- `displayOrder` - Ordering priority
- `isActive` - Active/inactive status
- `platform` - web/app/both
- `rating` - 0-5 rating
- `views` - View counter
- `likes` - Like counter
- `shares` - Share counter
- `createdBy`, `updatedBy`, `deletedBy` - User references
- `isDeleted` - Soft delete flag

---

## ERROR HANDLING

All endpoints return proper HTTP status codes:

- **200** - Success (GET, PATCH)
- **201** - Created (POST)
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Server Error

Error Response Format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## NOTES

1. **Banners** automatically upload images to AWS S3 before saving to database
2. **Success Stories** are text-only (no image uploads)
3. Both support soft delete (recoverable) and permanent delete
4. Pagination supported on all list endpoints
5. Search functionality on admin endpoints
6. Audit trail tracking (createdBy, updatedBy, deletedBy)
7. Engagement tracking (clicks for banners, likes/shares/views for stories)
8. Date filtering for active banners only
