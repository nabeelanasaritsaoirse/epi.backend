# File Upload Guide - AWS S3 + Database Integration

## Overview
Your system uploads files to AWS S3 and stores references in the database for easy frontend fetching.

## Architecture

```
Frontend (File)
    ↓
Multer Middleware (File Buffer)
    ↓
Sharp Processor (Resize/Optimize)
    ↓
AWS S3 Upload (uploadToS3)
    ↓
Database Save (ImageStore Model)
    ↓
Return S3 URL to Frontend
```

## File Upload Flow

### 1. **Frontend Request**
```javascript
// Upload endpoint
POST /api/image-store
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- image: <file>
- title: "Product Banner"
- type: "banner"
- platform: "web"
- altText: "Banner description"
```

### 2. **Multer Processing** (`routes/imageStore.js`)
- Validates file type (jpeg, jpg, png, webp, gif, svg)
- Max file size: 10MB
- Stores in memory buffer

### 3. **Image Optimization** (`processAndUploadImage` middleware)
- Reads image metadata (width, height)
- Resizes to 1200px width maintaining aspect ratio
- Compresses to JPEG quality 90
- Converts to buffer

### 4. **AWS S3 Upload** (`services/awsUploadService.js`)
```javascript
uploadToS3(buffer, folder, fileName)
```
Returns: `https://bucket-name.s3.region.amazonaws.com/folder/fileName`

### 5. **Database Storage** (`models/ImageStore.js`)
Stores complete reference:
```javascript
{
  imagePath: "image-store/timestamp-random.jpg",
  imageUrl: "https://bucket.s3.region.amazonaws.com/...",
  title: "Product Banner",
  type: "banner",
  platform: "web",
  width: 1200,
  height: 800,
  fileSize: 150000,
  mimeType: "image/jpeg",
  altText: "Banner description",
  isActive: true,
  createdBy: userId,
  createdAt: timestamp
}
```

## Database Fields for Easy Frontend Fetching

| Field | Purpose | Frontend Use |
|-------|---------|--------------|
| `imageUrl` | Direct S3 URL | Display in `<img src>` |
| `title` | Image name | Label/metadata |
| `type` | Category (banner, product, etc) | Route-based filtering |
| `platform` | Device target (web, app, both) | Responsive loading |
| `altText` | Accessibility | SEO + screen readers |
| `width` | Image dimension | Layout planning |
| `height` | Image dimension | Aspect ratio maintenance |
| `linkUrl` | Optional redirect | CTAs on banners |
| `isActive` | Publishing status | Only show active images |
| `orderBy` | Display sequence | Sorting on frontend |

## API Endpoints

### Upload Image
```
POST /api/image-store
Authentication: Required (Admin)
```

### Fetch Active Images by Type
```
GET /api/image-store/type/:type
Example: GET /api/image-store/type/banner
Response:
{
  success: true,
  data: [
    {
      _id: "...",
      imageUrl: "https://...",
      title: "Banner 1",
      altText: "...",
      linkUrl: "...",
      width: 1200,
      height: 600
    }
  ]
}
```

### Fetch All Active Images (Admin)
```
GET /api/image-store/admin/active
Authentication: Required (Admin)
```

### Update Image
```
PUT /api/image-store/:id
```

### Delete Image
```
DELETE /api/image-store/:id
```

## Frontend Integration Example

### React Component
```javascript
import { useEffect, useState } from 'react';

function BannerSlider() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    // Fetch active banners from database via API
    fetch('/api/image-store/type/banner')
      .then(res => res.json())
      .then(data => setBanners(data.data.sort((a, b) => a.orderBy - b.orderBy)))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      {banners.map(banner => (
        <div key={banner._id}>
          <img 
            src={banner.imageUrl} 
            alt={banner.altText}
            width={banner.width}
            height={banner.height}
            onClick={() => banner.linkUrl && window.location.href = banner.linkUrl}
          />
        </div>
      ))}
    </div>
  );
}
```

### Vue Component
```vue
<template>
  <div class="banners">
    <img 
      v-for="banner in banners" 
      :key="banner._id"
      :src="banner.imageUrl"
      :alt="banner.altText"
      :width="banner.width"
      :height="banner.height"
      @click="banner.linkUrl && openLink(banner.linkUrl)"
    />
  </div>
</template>

<script>
export default {
  data() {
    return { banners: [] };
  },
  mounted() {
    fetch('/api/image-store/type/banner')
      .then(res => res.json())
      .then(data => this.banners = data.data.sort((a, b) => a.orderBy - b.orderBy));
  }
}
</script>
```

## AWS S3 Configuration

Required Environment Variables:
```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=company-video-storage-prod
```

S3 Bucket Settings:
- ✅ Public Read Access (ACL: public-read)
- ✅ Block: None (allow public objects)
- ✅ CORS enabled for your frontend domain
- ✅ Versioning enabled (optional)

## Features

### Image Types
- banner
- category
- product
- promotional
- slider
- icon
- logo
- background
- advertisement

### Platforms
- web
- app
- both

### Admin Features
- Bulk upload
- Reorder images (orderBy)
- Toggle status (active/inactive)
- Soft delete (isDeleted flag)
- Permanent delete
- Click count tracking
- Search & filter

## Error Handling

### Common Issues

**1. File too large**
- Limit: 10MB per file
- Solution: Compress before upload

**2. Invalid file type**
- Allowed: jpeg, jpg, png, webp, gif, svg
- Solution: Convert to supported format

**3. S3 upload fails**
- Check AWS credentials
- Verify bucket exists
- Check bucket permissions

**4. Image not visible**
- Verify imageUrl is accessible
- Check S3 ACL settings
- Verify CORS configuration

## Performance Tips

1. **Lazy Load Images** - Load when visible
```javascript
<img src={url} loading="lazy" />
```

2. **Use Responsive Images**
```html
<picture>
  <source srcSet={tabletUrl} media="(max-width: 768px)" />
  <img src={desktopUrl} alt="..." />
</picture>
```

3. **Cache Database Queries** - Cache frequently used images
```javascript
// Cache for 1 hour
app.get('/api/image-store/type/:type', cache('1 hour'), controller.getByType);
```

4. **Monitor S3 Costs** - Regular cleanup of deleted images
```javascript
// Archive old deleted images
node scripts/archiveDeletedImages.js
```

## Security

✅ File type validation
✅ File size limits
✅ Virus scanning (optional - add to processAndUploadImage)
✅ Admin authentication required
✅ S3 ACL: public-read (read-only)
✅ Image metadata stripping (optional)

## Batch Operations

### Upload Multiple Files
```javascript
const { uploadMultipleFilesToS3 } = require('../services/awsUploadService');

const results = await uploadMultipleFilesToS3(files, 'products/', 800);
// results: [{url, key, mimeType, size, originalName}, ...]
```

### Delete Multiple Files
```javascript
const { deleteMultipleImagesFromS3 } = require('../services/awsUploadService');

await deleteMultipleImagesFromS3([url1, url2, url3]);
```

## Database Queries for Frontend

### Get All Active Banners (Sorted)
```javascript
ImageStore.find({ type: 'banner', isActive: true, isDeleted: false })
  .sort({ orderBy: 1 })
  .select('imageUrl title altText linkUrl width height');
```

### Get Images by Platform
```javascript
ImageStore.find({ 
  platform: { $in: ['web', 'both'] }, 
  isActive: true,
  isDeleted: false 
});
```

### Search Images
```javascript
ImageStore.find({
  $or: [
    { title: { $regex: search, $options: 'i' } },
    { altText: { $regex: search, $options: 'i' } }
  ],
  isDeleted: false
});
```

## Testing Upload

### Using cURL
```bash
curl -X POST http://localhost:5000/api/image-store \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "title=Test Banner" \
  -F "type=banner" \
  -F "platform=web"
```

### Using Thunder Client/Postman
1. Method: POST
2. URL: `http://localhost:5000/api/image-store`
3. Headers: `Authorization: Bearer token`
4. Body (form-data):
   - image: Select file
   - title: "Test Banner"
   - type: "banner"
   - platform: "web"

## Next Steps

1. ✅ Verify AWS credentials in `.env`
2. ✅ Test upload endpoint
3. ✅ Integrate frontend components
4. ✅ Set up image caching
5. ✅ Monitor S3 usage
6. ✅ Add virus scanning (optional)
7. ✅ Set up CloudFront CDN (optional)

