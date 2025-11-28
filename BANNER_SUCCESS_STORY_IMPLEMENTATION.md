# Banner & Success Story - Photo Only Implementation ✅

## Overview
Both **Banners** and **Success Stories** are now **photo/image only** with complete AWS S3 integration and database references.

---

## Architecture Diagram

```
Frontend (Photo Upload)
         ↓
    Multer Handler (memory buffer)
         ↓
    Sharp Processor (metadata + resize to 1200px + compress JPEG quality 90)
         ↓
    AWS S3 Upload (uploadToS3 service)
         ↓
    Database Save (MongoDB with S3 URL reference)
         ↓
    Return to Frontend with _id, imageUrl, dimensions
```

---

## Database Models

### Banner Model
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String,
  imageUrl: String (S3 URL - required),
  imageKey: String (S3 path - required),
  altText: String,
  imageWidth: Number,
  imageHeight: Number,
  imageSize: Number (bytes),
  linkUrl: String (optional redirect),
  targetBlank: Boolean,
  displayOrder: Number,
  isActive: Boolean,
  platform: String (web|app|both),
  startDate: Date (optional),
  endDate: Date (optional),
  clickCount: Number,
  impressions: Number,
  createdBy: ObjectId (User),
  updatedBy: ObjectId (User),
  deletedBy: ObjectId (User),
  isDeleted: Boolean (soft delete),
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Success Story Model
```javascript
{
  _id: ObjectId,
  title: String (required),
  description: String,
  imageUrl: String (S3 URL - required),
  imageKey: String (S3 path - required),
  altText: String,
  imageWidth: Number,
  imageHeight: Number,
  imageSize: Number (bytes),
  displayOrder: Number,
  isActive: Boolean,
  platform: String (web|app|both),
  rating: Number (0-5),
  views: Number,
  shares: Number,
  likes: Number,
  createdBy: ObjectId (User),
  updatedBy: ObjectId (User),
  deletedBy: ObjectId (User),
  isDeleted: Boolean (soft delete),
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

---

## AWS S3 Integration

### Upload Service (`services/awsUploadService.js`)
Used by both routes for S3 operations:

```javascript
uploadToS3(fileBuffer, folder, fileName)
// Returns: S3 URL
// Example: https://bucket.s3.region.amazonaws.com/banners/timestamp.jpg

deleteImageFromS3(imageUrl)
// Deletes from S3

deleteMultipleImagesFromS3(imageUrls)
// Batch delete from S3
```

### Image Processing Middleware
Located in both routes:
- **Path**: `/routes/bannerRoutes.js` & `/routes/successStoryRoutes.js`
- **Function**: `processAndUploadImage`
- **Steps**:
  1. Read file metadata (dimensions)
  2. Resize to 1200px width (maintaining aspect ratio)
  3. Compress as JPEG (quality 90)
  4. Upload to S3
  5. Attach S3 data to request

---

## API Endpoints Summary

### BANNER ENDPOINTS

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/banners` | Admin | Create banner with photo |
| GET | `/api/banners/public/active` | Public | Get active banners |
| GET | `/api/banners/admin/all` | Admin | Get all banners |
| GET | `/api/banners/:id` | Public | Get single banner |
| PUT | `/api/banners/:id` | Admin | Update banner metadata |
| PUT | `/api/banners/:id/image` | Admin | Replace banner image |
| PATCH | `/api/banners/:id/toggle` | Admin | Toggle active/inactive |
| DELETE | `/api/banners/:id` | Admin | Soft delete |
| DELETE | `/api/banners/:id/permanent` | Admin | Hard delete (S3 + DB) |
| POST | `/api/banners/:id/restore` | Admin | Restore soft-deleted |
| POST | `/api/banners/reorder` | Admin | Reorder banners |
| POST | `/api/banners/:id/click` | Public | Track click |
| GET | `/api/banners/admin/stats` | Admin | Get statistics |

### SUCCESS STORY ENDPOINTS

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/success-stories` | Admin | Create story with photo |
| GET | `/api/success-stories/public/active` | Public | Get active stories |
| GET | `/api/success-stories/admin/all` | Admin | Get all stories |
| GET | `/api/success-stories/:id` | Public | Get single story |
| PUT | `/api/success-stories/:id` | Admin | Update story metadata |
| PUT | `/api/success-stories/:id/image` | Admin | Replace story image |
| PATCH | `/api/success-stories/:id/toggle` | Admin | Toggle active/inactive |
| DELETE | `/api/success-stories/:id` | Admin | Soft delete |
| DELETE | `/api/success-stories/:id/permanent` | Admin | Hard delete |
| POST | `/api/success-stories/:id/restore` | Admin | Restore soft-deleted |
| POST | `/api/success-stories/reorder` | Admin | Reorder stories |
| PATCH | `/api/success-stories/:id/engagement` | Public | Like/share tracking |
| GET | `/api/success-stories/admin/stats` | Admin | Get statistics |

---

## Request/Response Examples

### Create Banner with Photo
```bash
curl -X POST http://localhost:3000/api/banners \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "image=@banner.jpg" \
  -F "title=Homepage Banner" \
  -F "description=Main banner" \
  -F "altText=Homepage banner" \
  -F "platform=web" \
  -F "displayOrder=1" \
  -F "linkUrl=https://example.com"
```

**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "_id": "673f5a1c9d2e4b1a8c3f2e1b",
    "title": "Homepage Banner",
    "imageUrl": "https://bucket.s3.ap-south-1.amazonaws.com/banners/1732087836441-abc123.jpg",
    "imageKey": "banners/1732087836441-abc123.jpg",
    "imageWidth": 1200,
    "imageHeight": 600,
    "altText": "Homepage banner",
    "displayOrder": 1,
    "platform": "web",
    "isActive": true,
    "createdAt": "2025-11-13T10:00:00Z"
  }
}
```

### Get Active Banners (Frontend)
```bash
curl "http://localhost:3000/api/banners/public/active?platform=web&limit=5"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "673f5a1c9d2e4b1a8c3f2e1b",
      "title": "Homepage Banner",
      "imageUrl": "https://bucket.s3.ap-south-1.amazonaws.com/banners/1732087836441-abc123.jpg",
      "altText": "Homepage banner",
      "linkUrl": "https://example.com",
      "imageWidth": 1200,
      "imageHeight": 600,
      "displayOrder": 1,
      "platform": "web"
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 5, "pages": 1 }
}
```

### Create Success Story with Photo
```bash
curl -X POST http://localhost:3000/api/success-stories \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "image=@success-story.jpg" \
  -F "title=Customer Success" \
  -F "description=Amazing transformation" \
  -F "altText=Success story image" \
  -F "platform=both" \
  -F "rating=5"
```

**Response:**
```json
{
  "success": true,
  "message": "Success story created successfully",
  "data": {
    "_id": "673f5a1c9d2e4b1a8c3f2e1c",
    "title": "Customer Success",
    "imageUrl": "https://bucket.s3.ap-south-1.amazonaws.com/success-stories/1732087900123-xyz789.jpg",
    "imageKey": "success-stories/1732087900123-xyz789.jpg",
    "imageWidth": 1200,
    "imageHeight": 800,
    "altText": "Success story image",
    "rating": 5,
    "displayOrder": 0,
    "platform": "both",
    "isActive": true,
    "views": 0,
    "likes": 0,
    "shares": 0,
    "createdAt": "2025-11-13T10:05:00Z"
  }
}
```

### Replace Banner Image
```bash
curl -X PUT http://localhost:3000/api/banners/673f5a1c9d2e4b1a8c3f2e1b/image \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "image=@new-banner.jpg"
```

### Get Success Story by ID (Auto-increment Views)
```bash
curl "http://localhost:3000/api/success-stories/673f5a1c9d2e4b1a8c3f2e1c"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "673f5a1c9d2e4b1a8c3f2e1c",
    "title": "Customer Success",
    "imageUrl": "https://bucket.s3.ap-south-1.amazonaws.com/success-stories/...",
    "views": 1,
    "likes": 0,
    "shares": 0,
    "rating": 5
  }
}
```

---

## Files Structure

### New/Modified Files:
```
models/
  ├── Banner.js ..................... Photo-based banner model
  └── SuccessStory.js ............... Photo-based story model

controllers/
  ├── bannerController.js ........... All banner CRUD + AWS operations
  └── successStoryController.js ..... All story CRUD + AWS operations

routes/
  ├── bannerRoutes.js .............. Banner endpoints + image processing
  └── successStoryRoutes.js ......... Story endpoints + image processing

services/
  └── awsUploadService.js .......... Used by both for S3 operations

index.js ........................... Added route registrations
```

---

## Key Features

### Both Banner & Success Story:
✅ **Photo Upload to AWS S3**
- Images resized to 1200px width
- JPEG compressed at quality 90
- Automatic metadata extraction (dimensions)

✅ **Database References**
- S3 URL stored in `imageUrl` field
- S3 key path stored in `imageKey` field
- Image dimensions stored for responsive display
- Image size tracked for analytics

✅ **Complete CRUD Operations**
- Create with photo upload
- Read (single & paginated)
- Update metadata
- Replace image
- Soft delete (recoverable)
- Hard delete (permanent from S3 + DB)
- Restore deleted items

✅ **Frontend Fetching**
- Get active banners/stories with pagination
- Filter by platform (web/app/both)
- Sort by display order
- Access direct S3 URLs

✅ **Admin Features**
- Search & filter
- Bulk operations
- Reordering
- Status toggle
- Analytics/statistics

✅ **Engagement Tracking**
- Banner: click count, impressions
- Story: views, likes, shares

---

## Frontend Integration

### React Example
```jsx
function DisplayBanners() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    fetch('/api/banners/public/active?platform=web')
      .then(res => res.json())
      .then(data => setBanners(data.data));
  }, []);

  return (
    <div>
      {banners.map(banner => (
        <img
          key={banner._id}
          src={banner.imageUrl}    // Direct S3 URL
          alt={banner.altText}
          width={banner.imageWidth}
          height={banner.imageHeight}
          onClick={() => {
            if (banner.linkUrl) window.location.href = banner.linkUrl;
            fetch(`/api/banners/${banner._id}/click`, { method: 'POST' });
          }}
        />
      ))}
    </div>
  );
}
```

### Vue Example
```vue
<template>
  <div class="stories">
    <img
      v-for="story in stories"
      :key="story._id"
      :src="story.imageUrl"
      :alt="story.altText"
      @click="handleStoryClick(story)"
    />
  </div>
</template>

<script>
export default {
  data() {
    return { stories: [] };
  },
  mounted() {
    fetch('/api/success-stories/public/active')
      .then(r => r.json())
      .then(d => this.stories = d.data);
  }
}
</script>
```

---

## Testing

### Test Banner Creation
```bash
npm test -- tests/banner.test.js
```

### Test Success Story Creation
```bash
npm test -- tests/successStory.test.js
```

### Manual Testing with Postman
1. Import provided Postman collection
2. Set `{{base_url}}` to `http://localhost:3000`
3. Set `{{admin_token}}` to valid JWT
4. Run requests in order

---

## Environment Variables Required

```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name

# Database
MONGODB_URI=mongodb+srv://...
DB_NAME=epi_backend

# Server
PORT=3000

# JWT
JWT_SECRET=your_secret_key
```

---

## Verification Checklist

- [x] Both models have `imageUrl` and `imageKey` fields
- [x] Both routes have image upload middleware
- [x] Both routes use `processAndUploadImage` middleware
- [x] Both controllers accept file from req.file.s3Url
- [x] AWS `uploadToS3` service is used for all uploads
- [x] Database saves S3 URLs for frontend fetching
- [x] Image replacement deletes old S3 file
- [x] Hard delete removes from both S3 and DB
- [x] Soft delete preserves S3 file
- [x] All CRUD operations implemented
- [x] Frontend can fetch with _id and imageUrl
- [x] Pagination, sorting, filtering implemented
- [x] Engagement tracking (clicks, views, likes, shares)
- [x] Audit trail (createdBy, updatedBy, deletedBy)

---

## Summary

✅ **Complete AWS S3 Integration** - All photos uploaded to AWS
✅ **Database References** - S3 URLs stored in MongoDB
✅ **Easy Frontend Fetching** - Direct S3 URLs with metadata
✅ **Full CRUD Operations** - Create, read, update, delete
✅ **Soft & Hard Delete** - Recoverable and permanent options
✅ **Admin Dashboard Ready** - All admin endpoints available
✅ **Engagement Tracking** - Metrics for both banners and stories
✅ **Responsive Images** - Dimensions stored for layout

