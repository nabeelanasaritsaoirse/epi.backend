# KYC System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Verification System](#verification-system)
3. [Mobile App APIs](#mobile-app-apis)
4. [Admin Panel APIs](#admin-panel-apis)
5. [Flow Diagrams](#flow-diagrams)
6. [Error Codes](#error-codes)
7. [Backward Compatibility](#backward-compatibility)

---

## Overview

The KYC (Know Your Customer) system allows users to submit identity documents for verification. Key features:

- **Phone/Email Verification Required**: Users must verify phone OR email before submitting KYC
- **Duplicate Detection**: Same Aadhaar/PAN cannot be used by multiple users
- **Auto-Approval**: KYC is auto-approved after 6 hours if not flagged as duplicate
- **Admin Review**: Duplicate submissions require manual admin review

### Document Types Supported
| Type | Front Required | Back Required |
|------|---------------|---------------|
| `selfie` | Yes | No |
| `aadhaar` | Yes | Yes |
| `pan` | Yes | No |
| `voter_id` | Yes | Yes |
| `driving_license` | Yes | Yes |

---

## Verification System

### How Verification Works

The system automatically tracks verification status from Firebase authentication:

| Login Method | What Happens |
|--------------|--------------|
| **Phone OTP** | Firebase token contains `phone_number` → `phoneVerified = true` |
| **Google Sign-in** | Firebase token contains `email_verified: true` → `emailVerified = true` |
| **Email Link** | Firebase token contains `email_verified: true` → `emailVerified = true` |

**Important**: The backend does NOT handle OTP verification - Firebase does. We only store the verification status from Firebase token.

### Verification Flow
```
User logs in via Firebase (Phone OTP / Google / Email)
                ↓
Backend receives Firebase token
                ↓
Token contains phone_number? → Set phoneVerified = true
Token contains email_verified = true? → Set emailVerified = true
                ↓
User can now submit KYC (if phoneVerified OR emailVerified is true)
```

---

## Mobile App APIs

### Base URL
```
Production: https://api.yourapp.com/api/kyc
Development: http://localhost:5000/api/kyc
```

### Authentication
All APIs require Bearer token in header:
```
Authorization: Bearer <firebase_id_token>
```

---

### 1. Upload KYC Document Image

Upload individual document images to S3 before submitting KYC.

**Endpoint:** `PUT /api/kyc/upload`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` or `file` | File | Yes | Image file (JPEG, PNG) |
| `type` | String | Yes | Document type: `selfie`, `aadhaar`, `pan`, `voter_id`, `driving_license` |
| `side` | String | Yes | `front` or `back` (selfie only allows `front`) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "type": "aadhaar",
  "side": "front",
  "url": "https://s3.amazonaws.com/bucket/kyc/userId/image.jpg"
}
```

**Error Responses:**
```json
// 400 - Missing file
{
  "success": false,
  "message": "Image file is required (image or file)"
}

// 400 - Invalid type
{
  "success": false,
  "message": "Invalid or missing document type"
}

// 400 - Invalid side for selfie
{
  "success": false,
  "message": "Selfie can only have side = 'front'"
}
```

---

### 2. Submit KYC

Submit all documents with Aadhaar and PAN numbers.

**Endpoint:** `POST /api/kyc/submit`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "aadhaarNumber": "123456789012",
  "panNumber": "ABCDE1234F",
  "documents": [
    {
      "type": "selfie",
      "frontUrl": "https://s3.../selfie_front.jpg"
    },
    {
      "type": "aadhaar",
      "frontUrl": "https://s3.../aadhaar_front.jpg",
      "backUrl": "https://s3.../aadhaar_back.jpg"
    },
    {
      "type": "pan",
      "frontUrl": "https://s3.../pan_front.jpg"
    }
  ]
}
```

**Validation Rules:**
- `aadhaarNumber`: Must be exactly 12 digits
- `panNumber`: Must match format `ABCDE1234F` (5 letters + 4 digits + 1 letter)
- Required documents: `selfie`, `aadhaar`, `pan`

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC submitted successfully",
  "status": "pending"
}
```

**Error Responses:**
```json
// 400 - Verification required
{
  "success": false,
  "message": "Please verify your phone number or email before submitting KYC",
  "code": "VERIFICATION_REQUIRED"
}

// 400 - Invalid Aadhaar
{
  "success": false,
  "message": "Invalid Aadhaar number"
}

// 400 - Invalid PAN
{
  "success": false,
  "message": "Invalid PAN number"
}

// 400 - Missing document
{
  "success": false,
  "message": "Missing required document type: aadhaar"
}

// 400 - Already approved
{
  "success": false,
  "message": "KYC already approved. Cannot resubmit."
}

// 400 - Already pending
{
  "success": false,
  "message": "KYC already pending. Please wait."
}
```

---

### 3. Get KYC Status

Check current KYC status and user verification info.

**Endpoint:** `GET /api/kyc/status`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response - KYC Not Submitted:**
```json
{
  "kycExists": false,
  "status": "not_submitted",
  "user": {
    "phoneNumber": "+919876543210",
    "email": "user@gmail.com",
    "phoneVerified": true,
    "emailVerified": false
  }
}
```

**Success Response - KYC Submitted:**
```json
{
  "kycExists": true,
  "status": "pending",
  "rejectionNote": null,
  "documents": [
    {
      "type": "selfie",
      "frontUrl": "https://s3.../selfie.jpg",
      "backUrl": null
    },
    {
      "type": "aadhaar",
      "frontUrl": "https://s3.../aadhaar_front.jpg",
      "backUrl": "https://s3.../aadhaar_back.jpg"
    },
    {
      "type": "pan",
      "frontUrl": "https://s3.../pan.jpg",
      "backUrl": null
    }
  ],
  "submittedAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "user": {
    "phoneNumber": "+919876543210",
    "email": "user@gmail.com",
    "phoneVerified": true,
    "emailVerified": false
  }
}
```

**KYC Status Values:**
| Status | Description |
|--------|-------------|
| `not_submitted` | User hasn't submitted KYC yet |
| `pending` | KYC submitted, awaiting review |
| `approved` | Manually approved by admin |
| `auto_approved` | Auto-approved after 6 hours |
| `rejected` | Rejected by admin (check `rejectionNote`) |

---

## Admin Panel APIs

### Base URL
```
/api/kyc/admin/*
/api/users/admin/*
```

### Authentication
Requires admin token:
```
Authorization: Bearer <admin_token>
```

---

### 1. Get All KYC Submissions

**Endpoint:** `GET /api/kyc/admin/all`

**Response:**
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "_id": "kyc_id_123",
      "userId": {
        "_id": "user_id_456",
        "name": "Rahul Kumar",
        "email": "rahul@gmail.com",
        "phoneNumber": "+919876543210",
        "phoneVerified": true,
        "emailVerified": false
      },
      "aadhaarNumber": "123456789012",
      "panNumber": "ABCDE1234F",
      "documents": [...],
      "status": "pending",
      "isDuplicate": true,
      "duplicateNote": "Aadhaar already registered with another user",
      "duplicateOf": {
        "_id": "kyc_id_789",
        "userId": "user_id_111",
        "aadhaarNumber": "123456789012",
        "panNumber": "ABCDE1234F"
      },
      "submittedAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Note:** Results are sorted with duplicates first, then by submission date (newest first).

---

### 2. Search KYC by Aadhaar/PAN

**Endpoint:** `GET /api/kyc/admin/search`

**Query Parameters:**
| Param | Description |
|-------|-------------|
| `aadhaarNumber` | Search by Aadhaar (partial match) |
| `panNumber` | Search by PAN (partial match) |
| `query` | Search both Aadhaar and PAN |

**Example Requests:**
```
GET /api/kyc/admin/search?aadhaarNumber=123456
GET /api/kyc/admin/search?panNumber=ABCDE
GET /api/kyc/admin/search?query=1234
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "kycId": "kyc_id_123",
      "status": "approved",
      "aadhaarNumber": "123456789012",
      "panNumber": "ABCDE1234F",
      "isDuplicate": false,
      "duplicateNote": null,
      "user": {
        "userId": "user_id_456",
        "name": "Rahul Kumar",
        "email": "rahul@gmail.com",
        "phoneNumber": "+919876543210",
        "phoneVerified": true,
        "emailVerified": false
      },
      "submittedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. Approve KYC

**Endpoint:** `PATCH /api/kyc/admin/approve/:id`

**URL Params:**
- `id`: KYC document ID

**Response:**
```json
{
  "success": true,
  "message": "KYC approved",
  "kyc": {
    "_id": "kyc_id_123",
    "status": "approved",
    ...
  }
}
```

---

### 4. Reject KYC

**Endpoint:** `PATCH /api/kyc/admin/reject/:id`

**URL Params:**
- `id`: KYC document ID

**Request Body:**
```json
{
  "note": "Aadhaar image is blurry. Please resubmit with clear image."
}
```

**Response:**
```json
{
  "success": true,
  "message": "KYC rejected",
  "kyc": {
    "_id": "kyc_id_123",
    "status": "rejected",
    "rejectionNote": "Aadhaar image is blurry. Please resubmit with clear image.",
    ...
  }
}
```

---

### 5. Get User Verification Status

**Endpoint:** `GET /api/users/admin/verification-status/:userId`

**URL Params:**
- `userId`: User's MongoDB ID

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_id_456",
    "name": "Rahul Kumar",
    "email": "rahul@gmail.com",
    "phoneNumber": "+919876543210",
    "phoneVerified": true,
    "emailVerified": false,
    "authMethod": "phone",
    "createdAt": "2024-01-10T08:00:00.000Z"
  }
}
```

**authMethod Values:**
| Value | Description |
|-------|-------------|
| `phone` | User registered via Phone OTP |
| `email` | User registered via Email |
| `google` | User registered via Google Sign-in |
| `unknown` | Auth method not determined |

---

## Flow Diagrams

### Mobile App - KYC Submission Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER OPENS KYC SCREEN                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GET /api/kyc/status                             │
│                                                                  │
│  Response contains:                                              │
│  - user.phoneVerified                                            │
│  - user.emailVerified                                            │
│  - kycExists                                                     │
│  - status                                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  phoneVerified = false   │    │  phoneVerified = true    │
│  emailVerified = false   │    │  OR emailVerified = true │
│                          │    │                          │
│  Show: "Please verify    │    │  Show KYC form           │
│  your phone or email"    │    │                          │
└──────────────────────────┘    └──────────────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Redirect to             │    │  1. Upload Selfie        │
│  Phone/Email Verification│    │  2. Upload Aadhaar       │
│  (Firebase handles this) │    │  3. Upload PAN           │
└──────────────────────────┘    │  4. Enter Aadhaar Number │
                                │  5. Enter PAN Number     │
                                └──────────────────────────┘
                                              │
                                              ▼
                                ┌──────────────────────────┐
                                │  For each document:      │
                                │  PUT /api/kyc/upload     │
                                │                          │
                                │  Save returned URLs      │
                                └──────────────────────────┘
                                              │
                                              ▼
                                ┌──────────────────────────┐
                                │  POST /api/kyc/submit    │
                                │                          │
                                │  Send all URLs +         │
                                │  Aadhaar + PAN numbers   │
                                └──────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
                ┌──────────────────────────┐    ┌──────────────────────────┐
                │  Success                 │    │  Error                   │
                │                          │    │                          │
                │  Show: "KYC submitted    │    │  Show error message      │
                │  successfully"           │    │  from response           │
                └──────────────────────────┘    └──────────────────────────┘
```

### Admin Panel - KYC Review Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN OPENS KYC LIST                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GET /api/kyc/admin/all                          │
│                                                                  │
│  Response sorted by:                                             │
│  1. isDuplicate = true (first)                                   │
│  2. submittedAt (newest first)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DISPLAY KYC LIST                             │
│                                                                  │
│  Show columns:                                                   │
│  - User Name                                                     │
│  - Phone Number (with verified badge)                            │
│  - Email (with verified badge)                                   │
│  - Aadhaar Number                                                │
│  - PAN Number                                                    │
│  - Status                                                        │
│  - isDuplicate (highlight if true)                               │
│  - duplicateNote                                                 │
│  - Actions (Approve/Reject)                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  APPROVE                 │    │  REJECT                  │
│                          │    │                          │
│  PATCH /api/kyc/admin/   │    │  Show rejection note     │
│  approve/:id             │    │  input modal             │
│                          │    │                          │
│  Updates status to       │    │  PATCH /api/kyc/admin/   │
│  "approved"              │    │  reject/:id              │
│                          │    │                          │
│                          │    │  { "note": "reason" }    │
└──────────────────────────┘    └──────────────────────────┘
```

### Duplicate Detection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                USER SUBMITS KYC                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Check: Is this Aadhaar already used by another user?           │
│                                                                  │
│  Query: Kyc.findOne({                                            │
│    aadhaarNumber: submitted_aadhaar,                             │
│    userId: { $ne: current_user },                                │
│    status: { $in: ['approved', 'auto_approved', 'pending'] }     │
│  })                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Found                   │    │  Not Found               │
│                          │    │                          │
│  isDuplicate = true      │    │  (Same check for PAN)    │
│  duplicateOf = found._id │    │                          │
│  duplicateNote = "..."   │    │                          │
└──────────────────────────┘    └──────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SAVE KYC                                     │
│                                                                  │
│  - KYC is ALWAYS saved (not rejected)                            │
│  - If duplicate: isDuplicate = true                              │
│  - Admin will see duplicates first in list                       │
│  - Auto-approve SKIPS duplicates                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Approval Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              CRON JOB (Runs every minute)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Find all KYC where:                                             │
│  - status = "pending"                                            │
│  - isDuplicate != true  (SKIP duplicates)                        │
│  - submittedAt <= 6 hours ago                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each matching KYC:                                          │
│  - Set status = "auto_approved"                                  │
│  - Set updatedAt = now                                           │
│  - Save                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Codes

| Code | HTTP Status | Message | Action |
|------|-------------|---------|--------|
| `VERIFICATION_REQUIRED` | 400 | Please verify your phone number or email before submitting KYC | Redirect user to phone/email verification |
| - | 400 | Invalid Aadhaar number | Aadhaar must be 12 digits |
| - | 400 | Invalid PAN number | PAN must be format: ABCDE1234F |
| - | 400 | Missing required document type: X | All required docs needed |
| - | 400 | KYC already approved. Cannot resubmit. | User cannot resubmit |
| - | 400 | KYC already pending. Please wait. | User must wait |
| - | 404 | User not found | Invalid user token |
| - | 404 | KYC not found | Invalid KYC ID (admin) |
| - | 500 | Server error | Contact backend team |

---

## Backward Compatibility

### Existing Users - No Impact

| Scenario | What Happens |
|----------|--------------|
| Existing user logs in | Verification flags are synced from Firebase token |
| Existing approved KYC | No change, user can continue normally |
| Existing pending KYC | Will still auto-approve after 6 hours |
| Old KYC records | `isDuplicate` treated as `false` |

### Why It's Safe

1. **New fields have defaults**: `emailVerified: false`, `isDuplicate: false`
2. **MongoDB is schemaless**: No migration needed
3. **Queries handle undefined**: `isDuplicate: { $ne: true }` matches both `false` and `undefined`
4. **API responses normalize values**: `isDuplicate: kyc.isDuplicate || false`

### Technical Details

```javascript
// Safe query pattern (matches false AND undefined)
isDuplicate: { $ne: true }

// Safe response pattern (handles undefined)
isDuplicate: kyc.isDuplicate || false,
duplicateNote: kyc.duplicateNote || null,

// Auth sync only updates if needed
if (!user.phoneVerified) {
  user.phoneVerified = true;
  needsUpdate = true;
}
```

---

## Quick Reference

### Mobile App Checklist
- [ ] Call `GET /api/kyc/status` on KYC screen load
- [ ] Check `user.phoneVerified` OR `user.emailVerified` before showing form
- [ ] Upload each document via `PUT /api/kyc/upload`
- [ ] Submit all URLs via `POST /api/kyc/submit`
- [ ] Handle `VERIFICATION_REQUIRED` error code
- [ ] Show `rejectionNote` when status is `rejected`

### Admin Panel Checklist
- [ ] Highlight rows where `isDuplicate = true`
- [ ] Show `duplicateNote` for duplicates
- [ ] Show phone/email verified badges
- [ ] Implement search by Aadhaar/PAN
- [ ] Show rejection note input on reject action
- [ ] Refresh list after approve/reject

---

## Contact

For backend issues or questions, contact the backend team.

**Last Updated:** January 2024
**Version:** 2.0 (with duplicate detection and verification)
