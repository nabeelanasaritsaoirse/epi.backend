# Product Review System - Complete Integration Guide

## Overview

This document provides comprehensive integration guidelines for the **Admin Panel** and **Mobile App Frontend** teams to integrate the product review system.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Mobile App Integration](#mobile-app-integration)
   - [Check Review Eligibility](#1-check-review-eligibility)
   - [Upload Review Images](#2-upload-review-images)
   - [Create a Review](#3-create-a-review)
   - [Get Product Reviews](#4-get-product-reviews-public)
   - [Get User's Reviews](#5-get-users-own-reviews)
   - [Update Review](#6-update-review)
   - [Delete Review](#7-delete-review)
   - [Vote on Review](#8-vote-on-review-helpfulness)
   - [Report Review](#9-report-a-review)
3. [Admin Panel Integration](#admin-panel-integration)
   - [Get All Reviews](#1-get-all-reviews-with-filters)
   - [Get Review Statistics](#2-get-review-statistics-dashboard)
   - [Get Flagged Reviews](#3-get-flagged-reviews)
   - [Get Review Details](#4-get-single-review-details)
   - [Unpublish Review](#5-unpublish-a-review)
   - [Publish Review](#6-publish-a-review)
   - [Delete Review (Admin)](#7-admin-delete-review)
   - [Respond to Review](#8-respond-to-review)
4. [Error Codes Reference](#error-codes-reference)
5. [Business Rules & Conditions](#business-rules--conditions)
6. [Data Models](#data-models)
7. [UI/UX Recommendations](#uiux-recommendations)

---

## System Architecture

### Base URLs
- **Production**: `https://api.epielio.com`
- **Development**: `http://localhost:5000`

### Authentication
All protected routes require the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

### Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errorCode": "ERROR_CODE",
  "details": { ... }
}
```

---

# Mobile App Integration

## 1. Check Review Eligibility

**Before showing the "Write Review" button**, always check if the user can review the product.

### Endpoint
```
GET /api/reviews/can-review/:productId
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
```

### Response
```json
{
  "success": true,
  "message": "Review eligibility checked",
  "data": {
    "canReview": true,
    "reason": null,
    "hasDeliveredOrder": true,
    "existingReviewId": null
  }
}
```

### Possible Scenarios

| `canReview` | `reason` | `existingReviewId` | UI Action |
|-------------|----------|-------------------|-----------|
| `true` | `null` | `null` | Show "Write Review" button |
| `false` | `NO_DELIVERED_ORDER` | `null` | Show "Purchase & get delivery to review" message |
| `false` | `ALREADY_REVIEWED` | `"review_id"` | Show "Edit Review" button (link to existing review) |

### Example UI Logic (React Native / Flutter)
```javascript
const checkCanReview = async (productId) => {
  const response = await api.get(`/reviews/can-review/${productId}`);

  if (response.data.canReview) {
    showWriteReviewButton();
  } else if (response.data.reason === 'NO_DELIVERED_ORDER') {
    showMessage('Complete your purchase and receive delivery to write a review');
  } else if (response.data.reason === 'ALREADY_REVIEWED') {
    showEditReviewButton(response.data.existingReviewId);
  }
};
```

---

## 2. Upload Review Images

**IMPORTANT: Images must be uploaded BEFORE creating the review.** This is a 2-step process:
1. Upload images using this endpoint → get S3 URLs back
2. Pass the S3 URLs in the `images` array when creating the review (Step 3)

### Endpoint
```
POST /api/reviews/upload-images
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

### Form Data

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `images` | file(s) | Yes | Max 5 files, accepts JPEG/PNG/WebP, max 10MB each |

### Example Request (React Native / Flutter)
```javascript
const uploadReviewImages = async (imageFiles) => {
  const formData = new FormData();

  // Append each image file to the form data
  imageFiles.forEach((file, index) => {
    formData.append('images', {
      uri: file.uri,
      type: file.type || 'image/jpeg',  // e.g., 'image/jpeg', 'image/png'
      name: file.name || `review-image-${index}.jpg`,
    });
  });

  const response = await fetch(`${BASE_URL}/api/reviews/upload-images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      // Do NOT set Content-Type manually - let fetch set it with boundary
    },
    body: formData,
  });

  return response.json();
};
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review images uploaded successfully",
  "data": {
    "images": [
      {
        "url": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/1706789012345-abc123.jpg",
        "thumbnail": null,
        "caption": ""
      },
      {
        "url": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/1706789012346-def456.jpg",
        "thumbnail": null,
        "caption": ""
      }
    ],
    "count": 2
  }
}
```

### What Happens During Upload
1. Images are received as `multipart/form-data` using the `images` field
2. Each image is **resized** to max 800px width (maintaining aspect ratio) using `sharp`
3. Images are **converted to JPEG** (quality 80%) for consistent format
4. Uploaded to **AWS S3** under the `reviews/` folder
5. S3 URLs are returned in the response

### Error Responses

**400 - No Files**
```json
{
  "success": false,
  "message": "No files uploaded. Send images using 'images' field."
}
```

**400 - Too Many Files**
```json
{
  "success": false,
  "message": "Maximum 5 images allowed per review"
}
```

**400 - Invalid File Type**
```json
{
  "success": false,
  "message": "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
}
```

**413 - File Too Large**
```json
{
  "success": false,
  "message": "File too large. Maximum size is 10MB per image."
}
```

### Complete Flow: Upload Images + Create Review
```javascript
// Step 1: Upload images first
const uploadResponse = await uploadReviewImages(selectedImages);
const imageUrls = uploadResponse.data.images; // Array of {url, thumbnail, caption}

// Step 2: Create review with the uploaded image URLs
const reviewResponse = await fetch(`${BASE_URL}/api/reviews`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    productId: 'PROD123',
    rating: 5,
    title: 'Great product!',
    comment: 'Amazing quality and fast delivery...',
    images: imageUrls.map(img => ({
      url: img.url,
      caption: 'My photo'  // Optional: add caption per image
    })),
    detailedRatings: {
      quality: 5,
      valueForMoney: 4,
      delivery: 5,
      accuracy: 5
    }
  }),
});
```

### UI Tips for Image Upload
- Show image preview thumbnails after selection
- Show upload progress indicator for each image
- Allow users to remove images before submitting the review
- Show "Uploading..." state while images are being uploaded to S3
- Only enable the "Submit Review" button after images finish uploading
- Handle upload failures gracefully - allow retry

---

## 3. Create a Review

> **Note:** If the user wants to add photos, upload them first using [Step 2: Upload Review Images](#2-upload-review-images) and use the returned S3 URLs in the `images` array below.

### Endpoint
```
POST /api/reviews
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "productId": "PROD123",
  "rating": 5,
  "title": "Excellent product!",
  "comment": "This product exceeded my expectations. The quality is amazing and delivery was fast. Highly recommend!",
  "images": [
    {
      "url": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/1706789012345-abc123.jpg",
      "caption": "Product in use"
    },
    {
      "url": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/1706789012346-def456.jpg",
      "caption": "Packaging quality"
    }
  ],
  "detailedRatings": {
    "quality": 5,
    "valueForMoney": 4,
    "delivery": 5,
    "accuracy": 5
  }
}
```

### Field Validations

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `productId` | string | Yes | Valid product ID or MongoDB _id |
| `rating` | number | Yes | 1-5 (whole numbers only) |
| `title` | string | Yes | Max 200 characters |
| `comment` | string | Yes | Max 2000 characters |
| `images` | array | No | Max 5 images recommended |
| `images[].url` | string | Yes (if images) | Valid URL |
| `images[].caption` | string | No | Max 100 characters |
| `detailedRatings.quality` | number | No | 1-5 |
| `detailedRatings.valueForMoney` | number | No | 1-5 |
| `detailedRatings.delivery` | number | No | 1-5 |
| `detailedRatings.accuracy` | number | No | 1-5 |

### Success Response (201)
```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "rating": 5,
      "title": "Excellent product!",
      "comment": "...",
      "userName": "John Doe",
      "verifiedPurchase": true,
      "status": "published",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "productStats": {
      "averageRating": 4.5,
      "totalReviews": 25
    },
    "autoModeration": null
  }
}
```

### Auto-Moderation Flagged Response (201)
If the review contains profanity or spam patterns, it gets flagged but still created:
```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "status": "flagged"
    },
    "productStats": { ... },
    "autoModeration": {
      "isFlagged": true,
      "message": "Your review has been flagged for moderation and will be reviewed by our team."
    }
  }
}
```

### Error Responses

**400 - Validation Error**
```json
{
  "success": false,
  "message": "productId, rating, title, and comment are required"
}
```

**400 - Invalid Rating**
```json
{
  "success": false,
  "message": "Rating must be between 1 and 5"
}
```

**400 - Order Not Delivered**
```json
{
  "success": false,
  "message": "You can only review products from delivered orders",
  "errorCode": "ORDER_NOT_DELIVERED"
}
```

**404 - Product Not Found**
```json
{
  "success": false,
  "message": "Product not found",
  "errorCode": "PRODUCT_NOT_FOUND"
}
```

**409 - Duplicate Review**
```json
{
  "success": false,
  "message": "You have already reviewed this product",
  "errorCode": "DUPLICATE_REVIEW"
}
```

---

## 4. Get Product Reviews (Public)

This endpoint is **PUBLIC** - no authentication required.

### Endpoint
```
GET /api/products/:productId/reviews
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Reviews per page (max 50) |
| `sort` | string | `newest` | Sort order (see below) |
| `rating` | string | - | Filter by ratings (comma-separated: "5,4") |
| `verified` | string | - | Set to "true" for verified purchases only |
| `hasImages` | string | - | Set to "true" for reviews with images only |
| `search` | string | - | Search in title and comment |

### Sort Options
- `newest` - Most recent first
- `oldest` - Oldest first
- `highest` - Highest rating first
- `lowest` - Lowest rating first
- `mostHelpful` - Most helpful (upvotes) first

### Example Request
```
GET /api/products/PROD123/reviews?page=1&limit=10&sort=mostHelpful&rating=5,4&verified=true
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Product reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id_1",
        "rating": 5,
        "title": "Amazing product!",
        "comment": "Best purchase I've made...",
        "userName": "John D.",
        "userProfilePicture": "https://...",
        "verifiedPurchase": true,
        "purchaseDate": "2024-01-10T00:00:00.000Z",
        "images": [
          { "url": "https://...", "caption": "My photo" }
        ],
        "detailedRatings": {
          "quality": 5,
          "valueForMoney": 4,
          "delivery": 5,
          "accuracy": 5
        },
        "variantInfo": {
          "variantName": "Red - Large",
          "color": "Red",
          "size": "Large"
        },
        "helpfulness": {
          "upvotes": 15,
          "downvotes": 2,
          "score": 13
        },
        "sellerResponse": {
          "message": "Thank you for your kind words!",
          "respondedAt": "2024-01-16T10:00:00.000Z",
          "isVisible": true
        },
        "qualityMetrics": {
          "wordCount": 45,
          "hasImages": true,
          "qualityScore": 75
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "ratingStats": {
      "averageRating": 4.5,
      "totalReviews": 125,
      "ratingDistribution": {
        "5": 80,
        "4": 25,
        "3": 10,
        "2": 5,
        "1": 5
      },
      "aspectRatings": {
        "quality": 4.6,
        "valueForMoney": 4.2,
        "delivery": 4.8,
        "accuracy": 4.5
      }
    },
    "pagination": {
      "total": 125,
      "page": 1,
      "limit": 10,
      "totalPages": 13
    }
  }
}
```

### UI Implementation Tips

1. **Rating Distribution Bar Chart**: Use `ratingDistribution` to show visual bars
2. **Aspect Ratings**: Show radar chart or individual progress bars
3. **Filter Chips**: Allow users to filter by star rating
4. **Verified Badge**: Show checkmark for `verifiedPurchase: true`
5. **Helpful Count**: Show "X people found this helpful" using `helpfulness.upvotes`
6. **Seller Response**: Display in a highlighted box below the review

---

## 5. Get User's Own Reviews

### Endpoint
```
GET /api/reviews/my-reviews
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Reviews per page |

### Success Response (200)
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id",
        "productName": "Premium Headphones",
        "productId": "PROD123",
        "rating": 5,
        "title": "Great sound!",
        "comment": "...",
        "status": "published",
        "editCount": 1,
        "helpfulness": { "upvotes": 5, "downvotes": 0, "score": 5 },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### UI Tips
- Show edit count remaining: `3 - editCount` edits left
- Indicate review status (published, flagged, unpublished)
- Link to product page

---

## 6. Update Review

Users can edit their review up to **3 times maximum**.

### Endpoint
```
PUT /api/reviews/:id
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body (all fields optional)
```json
{
  "rating": 4,
  "title": "Updated title",
  "comment": "Updated comment with more details...",
  "images": [...],
  "detailedRatings": {
    "quality": 4,
    "valueForMoney": 4,
    "delivery": 5,
    "accuracy": 4
  }
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "review": { ... },
    "editsRemaining": 2
  }
}
```

### Error Responses

**400 - Edit Limit Exceeded**
```json
{
  "success": false,
  "message": "Maximum edit limit (3) reached for this review",
  "errorCode": "REVIEW_EDIT_LIMIT_EXCEEDED",
  "details": { "reviewId": "...", "maxEdits": 3 }
}
```

**403 - Unauthorized**
```json
{
  "success": false,
  "message": "You are not authorized to access this review",
  "errorCode": "UNAUTHORIZED_REVIEW_ACCESS"
}
```

**404 - Review Not Found**
```json
{
  "success": false,
  "message": "Review not found",
  "errorCode": "REVIEW_NOT_FOUND"
}
```

### UI Implementation
- Show remaining edits: "2 edits remaining"
- Disable edit button when `editCount >= 3`
- Show warning: "This is your last edit" when `editCount === 2`

---

## 7. Delete Review

Soft deletes the user's own review.

### Endpoint
```
DELETE /api/reviews/:id
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review deleted successfully",
  "data": {
    "reviewId": "review_id"
  }
}
```

### Error Responses
- 403: Not authorized (not the owner)
- 404: Review not found

---

## 8. Vote on Review (Helpfulness)

Users can upvote or downvote reviews (not their own).

### Endpoint
```
POST /api/reviews/:id/vote
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "vote": "up"
}
```

| Value | Description |
|-------|-------------|
| `"up"` | Mark as helpful (upvote) |
| `"down"` | Mark as not helpful (downvote) |

### Success Response (200)
```json
{
  "success": true,
  "message": "Review upvoted successfully",
  "data": {
    "reviewId": "review_id",
    "helpfulness": {
      "upvotes": 16,
      "downvotes": 2,
      "score": 14
    },
    "yourVote": "up"
  }
}
```

### Error Responses

**400 - Invalid Vote**
```json
{
  "success": false,
  "message": "vote must be 'up' or 'down'"
}
```

**400 - Own Review**
```json
{
  "success": false,
  "message": "You cannot vote on your own review"
}
```

### UI Implementation
- Show thumbs up/down buttons
- Display count: "15 people found this helpful"
- Highlight button if user already voted
- Allow changing vote (vote again to change)

---

## 9. Report a Review

Users can report inappropriate reviews.

### Endpoint
```
POST /api/reviews/:id/report
```

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body
```json
{
  "reportType": "inappropriate",
  "reason": "Contains misleading information about the product"
}
```

### Report Types

| Type | When to Use |
|------|-------------|
| `spam` | Promotional content, ads, unrelated |
| `fake` | Suspected fake/purchased review |
| `inappropriate` | Inappropriate content or language |
| `offensive` | Offensive, hateful, or abusive content |

### Success Response (200)
```json
{
  "success": true,
  "message": "Review reported successfully",
  "data": {
    "reviewId": "review_id",
    "reportCount": 3,
    "status": "published"
  }
}
```

### Auto-Flagging
When a review receives **5 or more reports**, it is automatically flagged for admin review:
```json
{
  "data": {
    "reportCount": 5,
    "status": "flagged"
  }
}
```

### Error Responses

**400 - Invalid Report Type**
```json
{
  "success": false,
  "message": "reportType must be one of: spam, fake, inappropriate, offensive"
}
```

**400 - Own Review**
```json
{
  "success": false,
  "message": "You cannot report your own review"
}
```

**409 - Already Reported**
```json
{
  "success": false,
  "message": "You have already reported this review",
  "errorCode": "ALREADY_REPORTED"
}
```

---

# Admin Panel Integration

## Authentication
All admin routes require:
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

The admin user must have `isAdmin: true` in their profile.

---

## 1. Get All Reviews (with Filters)

### Endpoint
```
GET /api/reviews/admin/all
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Reviews per page (max 100) |
| `status` | string | - | Filter: `published`, `unpublished`, `draft`, `flagged` |
| `rating` | number | - | Filter by rating (1-5) |
| `productId` | string | - | Filter by product ID |
| `userId` | string | - | Filter by user ID |
| `includeDeleted` | string | `false` | Set to `true` to include soft-deleted reviews |
| `flagged` | string | - | Set to `true` for auto-flagged reviews only |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | Sort direction: `asc` or `desc` |

### Sort By Options
- `createdAt` - Creation date
- `rating` - Star rating
- `helpfulness.score` - Helpfulness score

### Example Request
```
GET /api/reviews/admin/all?status=flagged&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id",
        "user": {
          "_id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "product": {
          "_id": "product_id",
          "name": "Premium Headphones",
          "productId": "PROD123"
        },
        "rating": 1,
        "title": "Terrible product",
        "comment": "This contains bad word...",
        "status": "flagged",
        "autoModeration": {
          "isFlagged": true,
          "flagReason": "profanity",
          "confidence": 0.95
        },
        "reports": [
          {
            "reportedBy": "user_id",
            "reportType": "offensive",
            "reason": "Contains profanity",
            "reportedAt": "2024-01-15T10:00:00.000Z"
          }
        ],
        "helpfulness": { "upvotes": 0, "downvotes": 5, "score": -5 },
        "createdAt": "2024-01-15T09:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 2. Get Review Statistics (Dashboard)

### Endpoint
```
GET /api/reviews/admin/stats
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review statistics retrieved",
  "data": {
    "stats": {
      "totalReviews": 1250,
      "publishedReviews": 1180,
      "unpublishedReviews": 25,
      "flaggedReviews": 45,
      "autoFlaggedReviews": 30,
      "averageRating": 4.3,
      "rating5": 650,
      "rating4": 320,
      "rating3": 150,
      "rating2": 80,
      "rating1": 50,
      "totalUpvotes": 5600,
      "totalDownvotes": 890,
      "avgQualityScore": 68
    }
  }
}
```

### Dashboard Cards Suggested
| Card Title | Value | Icon |
|------------|-------|------|
| Total Reviews | `totalReviews` | Star |
| Published | `publishedReviews` | Check |
| Pending Moderation | `flaggedReviews` | Flag |
| Average Rating | `averageRating` | Star |
| Quality Score | `avgQualityScore`% | Quality |

---

## 3. Get Flagged Reviews

Reviews requiring moderation (auto-flagged, manually flagged, or has reports).

### Endpoint
```
GET /api/reviews/admin/flagged
```

### Query Parameters

| Parameter | Type | Default |
|-----------|------|---------|
| `page` | number | 1 |
| `limit` | number | 20 |

### Success Response (200)
```json
{
  "success": true,
  "message": "Flagged reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id",
        "user": { "name": "...", "email": "..." },
        "product": { "name": "...", "productId": "..." },
        "rating": 2,
        "title": "Bad product",
        "comment": "This fu**ing product is terrible...",
        "status": "flagged",
        "autoModeration": {
          "isFlagged": true,
          "flagReason": "profanity",
          "confidence": 0.95
        },
        "reports": [...],
        "createdAt": "2024-01-15T09:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

### Flag Reasons

| Reason | Description | Auto-Moderation Action |
|--------|-------------|----------------------|
| `profanity` | Contains bad words (English/Hindi) | Auto-flagged |
| `spam` | URLs, phone numbers, spam keywords | Auto-flagged |
| `repeated_characters` | Text like "aaaaa", "!!!!!!" | Auto-flagged |
| `excessive_caps` | More than 50% uppercase letters | Auto-flagged |
| `rating_mismatch` | Positive words with 1-2 stars, or negative words with 4-5 stars | Auto-flagged |
| `user_reported` | Received 5+ user reports | Status changed to flagged |

---

## 4. Get Single Review Details

### Endpoint
```
GET /api/reviews/admin/:id
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review details retrieved successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "user": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "profilePicture": "https://..."
      },
      "product": {
        "_id": "product_id",
        "name": "Premium Headphones",
        "productId": "PROD123",
        "images": [...],
        "pricing": { "finalPrice": 2999 }
      },
      "order": {
        "_id": "order_id",
        "orderId": "ORD123",
        "status": "COMPLETED",
        "deliveryStatus": "DELIVERED",
        "totalProductPrice": 2999
      },
      "rating": 5,
      "title": "...",
      "comment": "...",
      "images": [...],
      "detailedRatings": { ... },
      "variantInfo": { ... },
      "verifiedPurchase": true,
      "purchaseDate": "2024-01-01T00:00:00.000Z",
      "orderValue": 2999,
      "status": "published",
      "helpfulness": { ... },
      "sellerResponse": { ... },
      "qualityMetrics": { ... },
      "autoModeration": { ... },
      "reports": [...],
      "editHistory": [
        {
          "editedAt": "2024-01-10T10:00:00.000Z",
          "oldRating": 4,
          "oldTitle": "Good product",
          "oldComment": "Original comment..."
        }
      ],
      "editCount": 1,
      "moderationNote": "",
      "moderatedBy": null,
      "moderatedAt": null,
      "createdAt": "2024-01-05T10:00:00.000Z",
      "updatedAt": "2024-01-10T10:00:00.000Z"
    }
  }
}
```

---

## 5. Unpublish a Review

Hides the review from public view.

### Endpoint
```
PATCH /api/reviews/admin/:id/unpublish
```

### Request Body
```json
{
  "moderationNote": "Contains misleading claims about the product."
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review unpublished successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "status": "unpublished",
      "moderationNote": "Contains misleading claims...",
      "moderatedBy": "admin_id",
      "moderatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

## 6. Publish a Review

Makes a flagged/unpublished review visible again.

### Endpoint
```
PATCH /api/reviews/admin/:id/publish
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review published successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "status": "published",
      "autoModeration": { "isFlagged": false }
    }
  }
}
```

---

## 7. Admin Delete Review

Permanently soft-deletes a review (cannot be recovered by user).

### Endpoint
```
DELETE /api/reviews/admin/:id
```

### Request Body
```json
{
  "reason": "Fake review - user has not purchased the product"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Review deleted by admin",
  "data": {
    "reviewId": "review_id"
  }
}
```

---

## 8. Respond to Review

Add seller/admin response to a review.

### Endpoint
```
POST /api/reviews/admin/:id/respond
```

### Request Body
```json
{
  "message": "Thank you for your feedback! We're sorry to hear about your experience. Our support team will reach out to help resolve this issue."
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Response added successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "sellerResponse": {
        "message": "Thank you for your feedback!...",
        "respondedBy": "admin_id",
        "respondedByEmail": "admin@example.com",
        "respondedAt": "2024-01-15T10:00:00.000Z",
        "isVisible": true
      }
    }
  }
}
```

### Error Response

**400 - Missing Message**
```json
{
  "success": false,
  "message": "Response message is required"
}
```

---

# Error Codes Reference

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `REVIEW_NOT_FOUND` | 404 | Review not found | Review ID doesn't exist or is deleted |
| `DUPLICATE_REVIEW` | 409 | You have already reviewed this product | User tries to create second review |
| `ORDER_NOT_DELIVERED` | 400 | You can only review products from delivered orders | No delivered order for this product |
| `UNAUTHORIZED_REVIEW_ACCESS` | 403 | You are not authorized to access this review | Trying to edit/delete someone else's review |
| `REVIEW_EDIT_LIMIT_EXCEEDED` | 400 | Maximum edit limit (3) reached for this review | Already edited 3 times |
| `ALREADY_VOTED` | 409 | You have already voted on this review | (Currently allows re-voting) |
| `ALREADY_REPORTED` | 409 | You have already reported this review | User already reported this review |
| `PRODUCT_NOT_FOUND` | 404 | Product not found | Invalid product ID |

---

# Business Rules & Conditions

## Review Creation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| Delivery Required | User must have `deliveryStatus: "DELIVERED"` order | `ORDER_NOT_DELIVERED` |
| One Review Per Product | User can only have one active review per product | `DUPLICATE_REVIEW` |
| Rating Range | Must be 1-5 (whole numbers) | Validation error |
| Title Length | Max 200 characters | Validation error |
| Comment Length | Max 2000 characters | Validation error |

## Edit Rules

| Rule | Description |
|------|-------------|
| Max 3 Edits | Users can only edit their review 3 times total |
| Own Review Only | Users can only edit their own reviews |
| Not Deleted | Cannot edit deleted reviews |
| Re-moderation | Edited reviews are re-checked for profanity/spam |

## Voting Rules

| Rule | Description |
|------|-------------|
| Not Own Review | Users cannot vote on their own reviews |
| Change Vote Allowed | Users can change their vote (up to down, vice versa) |
| Logged In Required | Must be authenticated to vote |

## Reporting Rules

| Rule | Description |
|------|-------------|
| Not Own Review | Users cannot report their own reviews |
| One Report Per User | Users can only report a review once |
| Auto-Flag at 5 | Reviews with 5+ reports are auto-flagged |

## Auto-Moderation Rules

| Trigger | Action |
|---------|--------|
| Profanity Detected | Status set to `flagged`, visible to admin |
| Spam Patterns | Status set to `flagged` |
| Rating Mismatch | Status set to `flagged` (suspicious) |
| 5+ User Reports | Status changed from `published` to `flagged` |

---

# Data Models

## Review Object

```typescript
interface Review {
  _id: string;

  // References
  user: string | User;
  product: string | Product;
  order: string | Order;

  // Basic Review
  rating: number;           // 1-5
  title: string;            // max 200 chars
  comment: string;          // max 2000 chars

  // Detailed Ratings (optional)
  detailedRatings: {
    quality?: number;       // 1-5
    valueForMoney?: number; // 1-5
    delivery?: number;      // 1-5
    accuracy?: number;      // 1-5
  };

  // Images
  images: Array<{
    url: string;
    thumbnail?: string;
    caption?: string;
  }>;

  // Denormalized (for display without population)
  userName: string;
  userProfilePicture: string;
  productName: string;
  productId: string;

  // Verified Purchase
  verifiedPurchase: boolean;
  purchaseDate: Date;
  orderValue: number;

  // Variant Info
  variantInfo: {
    variantId?: string;
    variantName?: string;
    color?: string;
    size?: string;
    sku?: string;
    attributes?: object;
  };

  // Status
  status: 'published' | 'unpublished' | 'draft' | 'flagged';

  // Helpfulness
  helpfulness: {
    upvotes: number;
    downvotes: number;
    score: number;  // upvotes - downvotes
  };

  // Seller Response
  sellerResponse?: {
    message: string;
    respondedBy: string;
    respondedAt: Date;
    isVisible: boolean;
  };

  // Quality Metrics
  qualityMetrics: {
    wordCount: number;
    hasImages: boolean;
    hasDetailedRatings: boolean;
    qualityScore: number;  // 0-100
  };

  // Auto-Moderation
  autoModeration: {
    isFlagged: boolean;
    flagReason?: string;
    confidence?: number;
  };

  // Edit History
  editHistory: Array<{
    editedAt: Date;
    oldRating: number;
    oldTitle: string;
    oldComment: string;
  }>;
  editCount: number;  // 0-3

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

## Rating Stats Object

```typescript
interface RatingStats {
  averageRating: number;      // e.g., 4.5
  totalReviews: number;       // e.g., 125
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  aspectRatings: {
    quality: number;          // 0-5
    valueForMoney: number;    // 0-5
    delivery: number;         // 0-5
    accuracy: number;         // 0-5
  };
}
```

---

# UI/UX Recommendations

## Mobile App

### Product Page
1. **Rating Summary Card**
   - Large average rating (4.5)
   - Star icons
   - "Based on 125 reviews" text
   - Rating distribution bars
   - Aspect ratings (optional)

2. **Review List**
   - Show 3-5 reviews initially
   - "See all reviews" button
   - Filter chips (5 star, 4 star, With Photos, Verified Only)
   - Sort dropdown

3. **Individual Review Card**
   - User avatar + name
   - Verified badge (green checkmark)
   - Star rating
   - Title (bold)
   - Comment (expandable)
   - Images (gallery)
   - Variant purchased (small text)
   - Helpful count + buttons
   - Seller response (highlighted box)
   - Date

4. **Write Review Screen**
   - Star rating selector
   - Title input
   - Comment textarea with character count
   - Image upload (max 5) - **2-step flow**: upload via `POST /api/reviews/upload-images` first, then pass URLs in review creation
   - Show upload progress and preview thumbnails
   - Detailed ratings (accordion/expandable)
   - Submit button (disable until images finish uploading)
   - Show eligibility message if cannot review

### Profile > My Reviews
- List of user's reviews
- Edit button (if edits remaining)
- Delete button
- Status badge (Published/Under Review)

## Admin Panel

### Dashboard Cards
- Total Reviews
- Pending Moderation (flagged count)
- Average Rating
- Quality Score

### Review Management Table
- Columns: User, Product, Rating, Status, Date, Actions
- Quick actions: View, Publish, Unpublish, Delete
- Bulk actions
- Filters sidebar

### Review Detail Modal
- Full review content
- User info + order info
- Edit history timeline
- Reports list
- Moderation history
- Response composer
- Action buttons (Publish/Unpublish/Delete)

### Flagged Reviews Queue
- Priority list of flagged reviews
- Show flag reason prominently
- Quick approve/reject buttons
- Response template dropdown

---

## Questions?

Contact the backend team for any integration questions or issues.

**API Support**: backend-team@epielio.com
