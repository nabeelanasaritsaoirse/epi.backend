# Banner & Success Story - Photo Upload API

## Quick Summary

Both **Banners** and **Success Stories** are **photo-only** with ID and description for easy frontend fetching.

---

## BANNER API (Photo Only)

### Create Banner
```
POST /api/banners
Headers: Authorization: Bearer <token>, Content-Type: multipart/form-data

Body:
- image: <File>           (Required - jpeg, jpg, png, webp)
- title: "string"         (Required)
- description: "string"   (Optional)
- altText: "string"       (Optional)
- displayOrder: number    (Optional, default: 0)
- platform: "web|app|both" (Optional, default: both)
- linkUrl: "string"       (Optional)
- targetBlank: "true|false" (Optional)

Response:
{
  "success": true,
  "data": {
    "_id": "banner_id",
    "title": "Banner Title",
    "description": "Banner description",
    "imageUrl": "https://s3.../banner.jpg",
    "imageKey": "banners/timestamp.jpg",
    "displayOrder": 0,
    "isActive": true,
    "platform": "web"
  }
}
```

### Get All Active Banners (Frontend)
```
GET /api/banners/public/active?platform=web&page=1&limit=10

Response:
{
  "success": true,
  "data": [
    {
      "_id": "banner_id",
      "title": "Banner Title",
      "description": "Banner description",
      "imageUrl": "https://s3.../banner.jpg",
      "altText": "Alt text",
      "imageWidth": 1200,
      "imageHeight": 600,
      "displayOrder": 0
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
}
```

### Get All Banners (Admin)
```
GET /api/banners/admin/all?isActive=true&platform=web&page=1&limit=20
Auth: Admin Required
```

### Get Single Banner
```
GET /api/banners/:id

Response:
{
  "success": true,
  "data": {
    "_id": "banner_id",
    "title": "Banner Title",
    "description": "Banner description",
    "imageUrl": "https://s3.../banner.jpg",
    "imageKey": "banners/timestamp.jpg",
    "imageWidth": 1200,
    "imageHeight": 600,
    "clickCount": 42
  }
}
```

### Update Banner (Metadata Only)
```
PUT /api/banners/:id
Auth: Admin Required
Content-Type: application/json

Body:
{
  "title": "string",
  "description": "string",
  "altText": "string",
  "displayOrder": number,
  "platform": "web|app|both",
  "linkUrl": "string",
  "targetBlank": boolean,
  "isActive": boolean
}
```

### Replace Banner Image
```
PUT /api/banners/:id/image
Auth: Admin Required
Content-Type: multipart/form-data

Body:
- image: <File>  (Required - New image)
```

### Toggle Banner Status
```
PATCH /api/banners/:id/toggle
Auth: Admin Required

Response: { "success": true, "data": { ...updated banner... } }
```

### Delete Banner (Soft Delete)
```
DELETE /api/banners/:id
Auth: Admin Required

Response: { "success": true, "message": "Banner soft deleted successfully" }
```

### Permanently Delete Banner
```
DELETE /api/banners/:id/permanent
Auth: Admin Required

Response: { "success": true, "message": "Banner permanently deleted successfully" }
```

### Restore Banner
```
POST /api/banners/:id/restore
Auth: Admin Required
```

### Reorder Banners
```
POST /api/banners/reorder
Auth: Admin Required
Content-Type: application/json

Body:
{
  "bannerOrders": [
    { "id": "banner_id_1", "displayOrder": 1 },
    { "id": "banner_id_2", "displayOrder": 2 }
  ]
}
```

### Track Banner Click
```
POST /api/banners/:id/click

Response: { "success": true, "data": { "clickCount": 43 } }
```

### Get Banner Stats
```
GET /api/banners/admin/stats
Auth: Admin Required

Response:
{
  "success": true,
  "data": {
    "total": 10,
    "active": 8,
    "inactive": 2,
    "deleted": 1,
    "totalClicks": 150
  }
}
```

---

## SUCCESS STORY API (Photo Only)

### Create Success Story
```
POST /api/success-stories
Headers: Authorization: Bearer <token>, Content-Type: multipart/form-data

Body:
- image: <File>           (Required - jpeg, jpg, png, webp)
- title: "string"         (Required)
- description: "string"   (Optional)
- altText: "string"       (Optional)
- displayOrder: number    (Optional, default: 0)
- platform: "web|app|both" (Optional, default: both)

Response:
{
  "success": true,
  "data": {
    "_id": "story_id",
    "title": "Success Story Title",
    "description": "Story description",
    "imageUrl": "https://s3.../story.jpg",
    "imageKey": "success-stories/timestamp.jpg",
    "displayOrder": 0,
    "isActive": true,
    "views": 0
  }
}
```

### Get All Active Success Stories (Frontend)
```
GET /api/success-stories/public/active?platform=web&page=1&limit=10

Response:
{
  "success": true,
  "data": [
    {
      "_id": "story_id",
      "title": "Success Story Title",
      "description": "Story description",
      "imageUrl": "https://s3.../story.jpg",
      "altText": "Alt text",
      "imageWidth": 1200,
      "imageHeight": 600,
      "displayOrder": 0,
      "views": 100
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
}
```

### Get All Success Stories (Admin)
```
GET /api/success-stories/admin/all?isActive=true&platform=web&page=1&limit=20
Auth: Admin Required

Query Parameters:
- isActive: true|false
- platform: web|app|both
- search: search term
- page: page number
- limit: results per page
- sortBy: field name (default: displayOrder)
- sortOrder: asc|desc (default: asc)
```

### Get Single Success Story
```
GET /api/success-stories/:id

Note: Automatically increments view count

Response:
{
  "success": true,
  "data": {
    "_id": "story_id",
    "title": "Success Story Title",
    "description": "Story description",
    "imageUrl": "https://s3.../story.jpg",
    "imageKey": "success-stories/timestamp.jpg",
    "imageWidth": 1200,
    "imageHeight": 600,
    "views": 101
  }
}
```

### Update Success Story (Metadata Only)
```
PUT /api/success-stories/:id
Auth: Admin Required
Content-Type: application/json

Body:
{
  "title": "string",
  "description": "string",
  "altText": "string",
  "displayOrder": number,
  "platform": "web|app|both",
  "isActive": boolean
}
```

### Replace Success Story Image
```
PUT /api/success-stories/:id/image
Auth: Admin Required
Content-Type: multipart/form-data

Body:
- image: <File>  (Required - New image)
```

### Toggle Success Story Status
```
PATCH /api/success-stories/:id/toggle
Auth: Admin Required

Response: { "success": true, "data": { ...updated story... } }
```

### Delete Success Story (Soft Delete)
```
DELETE /api/success-stories/:id
Auth: Admin Required

Response: { "success": true, "message": "Success story soft deleted successfully" }
```

### Permanently Delete Success Story
```
DELETE /api/success-stories/:id/permanent
Auth: Admin Required

Response: { "success": true, "message": "Success story permanently deleted successfully" }
```

### Restore Success Story
```
POST /api/success-stories/:id/restore
Auth: Admin Required
```

### Reorder Success Stories
```
POST /api/success-stories/reorder
Auth: Admin Required
Content-Type: application/json

Body:
{
  "storyOrders": [
    { "id": "story_id_1", "displayOrder": 1 },
    { "id": "story_id_2", "displayOrder": 2 }
  ]
}
```

### Get Success Story Stats
```
GET /api/success-stories/admin/stats
Auth: Admin Required

Response:
{
  "success": true,
  "data": {
    "total": 20,
    "active": 18,
    "inactive": 2,
    "deleted": 0,
    "totalViews": 5000
  }
}
```

---

## DATABASE SCHEMA

### Banner Model
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  imageUrl: String,          // S3 URL
  imageKey: String,          // S3 key path
  altText: String,
  imageWidth: Number,
  imageHeight: Number,
  imageSize: Number,
  linkUrl: String,
  targetBlank: Boolean,
  displayOrder: Number,
  isActive: Boolean,
  platform: String,          // web|app|both
  clickCount: Number,
  createdBy: ObjectId,       // User reference
  updatedBy: ObjectId,
  isDeleted: Boolean,        // Soft delete flag
  deletedAt: Date,
  deletedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Success Story Model
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  imageUrl: String,          // S3 URL
  imageKey: String,          // S3 key path
  altText: String,
  imageWidth: Number,
  imageHeight: Number,
  imageSize: Number,
  displayOrder: Number,
  isActive: Boolean,
  platform: String,          // web|app|both
  views: Number,
  createdBy: ObjectId,       // User reference
  updatedBy: ObjectId,
  isDeleted: Boolean,        // Soft delete flag
  deletedAt: Date,
  deletedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## CURL EXAMPLES

### Create Banner
```bash
curl -X POST http://localhost:3000/api/banners \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/banner.jpg" \
  -F "title=Homepage Banner" \
  -F "description=Main banner for homepage" \
  -F "platform=web" \
  -F "displayOrder=1"
```

### Get Active Banners
```bash
curl http://localhost:3000/api/banners/public/active?platform=web&limit=5
```

### Create Success Story
```bash
curl -X POST http://localhost:3000/api/success-stories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/story.jpg" \
  -F "title=Customer Success" \
  -F "description=Amazing customer success story" \
  -F "platform=both"
```

### Get Active Success Stories
```bash
curl http://localhost:3000/api/success-stories/public/active?limit=10
```

### Update Banner Metadata
```bash
curl -X PUT http://localhost:3000/api/banners/banner_id \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "Updated description",
    "displayOrder": 2
  }'
```

### Replace Banner Image
```bash
curl -X PUT http://localhost:3000/api/banners/banner_id/image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/new-banner.jpg"
```

### Delete Banner
```bash
curl -X DELETE http://localhost:3000/api/banners/banner_id \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Permanently Delete Banner
```bash
curl -X DELETE http://localhost:3000/api/banners/banner_id/permanent \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## KEY FEATURES

✅ **Photo Only** - Both banners and stories are image-based  
✅ **AWS S3 Upload** - Automatic image upload and optimization  
✅ **Database Reference** - S3 URL stored in database for easy fetching  
✅ **ID Field** - Every banner/story has unique _id for identification  
✅ **Description** - Optional description field for easy sorting/searching  
✅ **Image Metadata** - Width, height, size stored automatically  
✅ **Soft Delete** - Recoverable deletion option  
✅ **Permanent Delete** - Complete removal from DB and S3  
✅ **Reordering** - Manage display sequence  
✅ **Pagination** - All list endpoints support pagination  
✅ **Filtering** - Filter by status, platform, type  
✅ **Tracking** - Click count for banners, view count for stories  
✅ **Admin Control** - Only admin can create/update/delete  
✅ **Public Endpoints** - Frontend can fetch active items without authentication  

