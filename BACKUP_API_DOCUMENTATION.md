# EPI Backend — Database Backup API Documentation

**Version:** 1.0
**Base URL:** `https://api.epielio.com` *(replace with your production domain)*
**Access Level:** Super Admin only
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [API Endpoints](#2-api-endpoints)
   - [1. Download Backup (Direct)](#api-1-download-backup-direct)
   - [2. Trigger S3 Backup](#api-2-trigger-s3-backup)
   - [3. List All Backups](#api-3-list-all-backups)
   - [4. Get Backup Download URL](#api-4-get-backup-download-url)
3. [Error Responses](#3-error-responses)
4. [Frontend Integration Guide](#4-frontend-integration-guide)
5. [Recommended UI Flow](#5-recommended-ui-flow)

---

## 1. Authentication

All backup endpoints require a **Super Admin JWT token**.

Include the token in every request header:

```
Authorization: Bearer <your_super_admin_jwt_token>
```

If the token is missing, invalid, or the user is not a Super Admin, the API returns:

```json
HTTP 401 Unauthorized
{
  "success": false,
  "message": "Unauthorized"
}
```

```json
HTTP 403 Forbidden
{
  "success": false,
  "message": "Access denied. Super admin privileges required."
}
```

---

## 2. API Endpoints

---

### API 1: Download Backup (Direct)

Downloads the complete database as a compressed `.json.gz` file directly to the browser/client.

**Endpoint**
```
GET /api/admin/backup/download
```

**Headers**
| Key | Value | Required |
|-----|-------|----------|
| `Authorization` | `Bearer <token>` | ✅ Yes |

**Request Body**
None

**Success Response**
```
HTTP 200 OK
Content-Type: application/gzip
Content-Disposition: attachment; filename="epi_backup_2026-02-27T10-30-00-000Z.json.gz"
Content-Length: <file size in bytes>
X-Backup-Collections: <number of collections>
```
Response body is a binary `.json.gz` file.

**After decompressing, the JSON structure is:**
```json
{
  "exportedAt": "2026-02-27T10:30:00.000Z",
  "databaseName": "epi",
  "totalCollections": 18,
  "collections": {
    "users": [ { "_id": "...", "name": "...", "email": "..." } ],
    "installmentorders": [ { "_id": "...", "userId": "..." } ],
    "products": [ { "_id": "...", "name": "..." } ]
  }
}
```

**Error Response**
```json
HTTP 500 Internal Server Error
{
  "success": false,
  "message": "Backup download failed"
}
```

**Frontend Code Example (React)**
```javascript
const downloadBackup = async (token) => {
  try {
    const response = await fetch('/api/admin/backup/download', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message);
    }

    // Get filename from response header
    const disposition = response.headers.get('Content-Disposition');
    const fileName = disposition?.split('filename="')[1]?.replace('"', '')
                     || 'epi_backup.json.gz';

    // Trigger browser download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Download failed:', error.message);
    alert('Backup download failed: ' + error.message);
  }
};
```

> ⚠️ **Note:** This endpoint loads the entire database into memory. For very large databases, use **API 2 + API 4** instead (trigger S3 backup, then get download URL).

---

### API 2: Trigger S3 Backup

Saves a full database backup to AWS S3 immediately. Use this for manual on-demand backups or before major operations.

> 💡 The system also runs this **automatically every Sunday at 2:00 AM IST**.

**Endpoint**
```
POST /api/admin/backup/trigger
```

**Headers**
| Key | Value | Required |
|-----|-------|----------|
| `Authorization` | `Bearer <token>` | ✅ Yes |

**Request Body**
None

**Success Response**
```json
HTTP 200 OK
{
  "success": true,
  "message": "Backup saved to S3 successfully",
  "data": {
    "fileName": "db-backups/backup_2026-02-27T10-30-00-000Z.json.gz",
    "sizeKB": 245.67,
    "collectionCount": 18,
    "exportedAt": "2026-02-27T10:30:00.000Z"
  }
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `data.fileName` | `string` | S3 key of the saved backup file |
| `data.sizeKB` | `number` | Size of compressed backup in kilobytes |
| `data.collectionCount` | `number` | Number of collections backed up |
| `data.exportedAt` | `string` | ISO timestamp of when backup was taken |

**Error Response**
```json
HTTP 500 Internal Server Error
{
  "success": false,
  "message": "S3 backup failed"
}
```

**Frontend Code Example (React)**
```javascript
const triggerS3Backup = async (token) => {
  try {
    const response = await fetch('/api/admin/backup/trigger', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    console.log('Backup saved:', result.data.fileName);
    console.log('Size:', result.data.sizeKB, 'KB');
    alert(`✅ Backup saved successfully!\nFile: ${result.data.fileName}\nSize: ${result.data.sizeKB} KB`);

    return result.data;

  } catch (error) {
    console.error('Backup failed:', error.message);
    alert('❌ Backup failed: ' + error.message);
  }
};
```

---

### API 3: List All Backups

Returns a list of all backup files stored in AWS S3, sorted by newest first.

**Endpoint**
```
GET /api/admin/backup/list
```

**Headers**
| Key | Value | Required |
|-----|-------|----------|
| `Authorization` | `Bearer <token>` | ✅ Yes |

**Request Body**
None

**Success Response**
```json
HTTP 200 OK
{
  "success": true,
  "count": 3,
  "backups": [
    {
      "fileName": "db-backups/backup_2026-02-27T02-00-00-000Z.json.gz",
      "name": "backup_2026-02-27T02-00-00-000Z.json.gz",
      "sizeKB": 312.45,
      "createdAt": "2026-02-27T02:00:05.000Z"
    },
    {
      "fileName": "db-backups/backup_2026-02-20T02-00-00-000Z.json.gz",
      "name": "backup_2026-02-20T02-00-00-000Z.json.gz",
      "sizeKB": 298.10,
      "createdAt": "2026-02-20T02:00:04.000Z"
    }
  ]
}
```

**Response Fields (each backup object)**
| Field | Type | Description |
|-------|------|-------------|
| `fileName` | `string` | Full S3 key — use this in API 4 to get download URL |
| `name` | `string` | Filename only (without folder path) |
| `sizeKB` | `number` | File size in kilobytes |
| `createdAt` | `string` | ISO timestamp when backup was created |

**Error Response**
```json
HTTP 500 Internal Server Error
{
  "success": false,
  "message": "Failed to list backups"
}
```

**Frontend Code Example (React)**
```javascript
const listBackups = async (token) => {
  try {
    const response = await fetch('/api/admin/backup/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.backups; // Array of backup objects

  } catch (error) {
    console.error('Failed to fetch backups:', error.message);
    return [];
  }
};
```

---

### API 4: Get Backup Download URL

Generates a temporary, secure download link for a specific S3 backup file. The link expires in **1 hour**.

**Endpoint**
```
GET /api/admin/backup/url?fileName=<s3_file_key>
```

**Headers**
| Key | Value | Required |
|-----|-------|----------|
| `Authorization` | `Bearer <token>` | ✅ Yes |

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileName` | `string` | ✅ Yes | The `fileName` value from API 3 response (e.g., `db-backups/backup_2026-02-27T02-00-00-000Z.json.gz`) |

**Example Request**
```
GET /api/admin/backup/url?fileName=db-backups/backup_2026-02-27T02-00-00-000Z.json.gz
```

**Success Response**
```json
HTTP 200 OK
{
  "success": true,
  "downloadUrl": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/db-backups/backup_2026-02-27T02-00-00-000Z.json.gz?X-Amz-Algorithm=...&X-Amz-Expires=3600...",
  "expiresIn": "1 hour"
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `downloadUrl` | `string` | Pre-signed S3 URL — valid for 1 hour. Open in browser or use as download `href` |
| `expiresIn` | `string` | Human-readable expiry duration |

**Error Responses**
```json
HTTP 400 Bad Request
{
  "success": false,
  "message": "fileName query parameter is required"
}
```
```json
HTTP 400 Bad Request
{
  "success": false,
  "message": "Invalid backup file name."
}
```
```json
HTTP 500 Internal Server Error
{
  "success": false,
  "message": "Failed to get download URL"
}
```

**Frontend Code Example (React)**
```javascript
const getBackupDownloadUrl = async (token, fileName) => {
  try {
    const encoded = encodeURIComponent(fileName);
    const response = await fetch(`/api/admin/backup/url?fileName=${encoded}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    // Open download link in new tab
    window.open(result.downloadUrl, '_blank');

    return result.downloadUrl;

  } catch (error) {
    console.error('Failed to get download URL:', error.message);
    alert('❌ Failed to get download link: ' + error.message);
  }
};
```

---

## 3. Error Responses

All endpoints follow the same error response format:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad Request — missing or invalid parameters |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — user is not Super Admin |
| `500` | Internal Server Error — backup/S3/DB operation failed |

---

## 4. Frontend Integration Guide

### Complete Backup Management Page Example (React)

```jsx
import React, { useState, useEffect } from 'react';

const BackupManager = ({ token }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Load backup list on mount
  useEffect(() => {
    fetchBackupList();
  }, []);

  const fetchBackupList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backup/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setBackups(data.backups);
    } catch (err) {
      setStatus('❌ Failed to load backup list');
    }
    setLoading(false);
  };

  const handleDirectDownload = async () => {
    setStatus('⏳ Preparing download...');
    try {
      const res = await fetch('/api/admin/backup/download', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `epi_backup_${Date.now()}.json.gz`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatus('✅ Download started!');
    } catch (err) {
      setStatus('❌ Download failed: ' + err.message);
    }
  };

  const handleTriggerS3Backup = async () => {
    setStatus('⏳ Saving backup to S3...');
    try {
      const res = await fetch('/api/admin/backup/trigger', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStatus(`✅ Backup saved! Size: ${data.data.sizeKB} KB`);
      fetchBackupList(); // Refresh list
    } catch (err) {
      setStatus('❌ Backup failed: ' + err.message);
    }
  };

  const handleDownloadFromS3 = async (fileName) => {
    setStatus('⏳ Generating download link...');
    try {
      const res = await fetch(
        `/api/admin/backup/url?fileName=${encodeURIComponent(fileName)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      window.open(data.downloadUrl, '_blank');
      setStatus('✅ Download link opened (expires in 1 hour)');
    } catch (err) {
      setStatus('❌ Failed: ' + err.message);
    }
  };

  return (
    <div>
      <h2>Database Backup Manager</h2>
      <p style={{ color: 'gray' }}>Auto backup runs every Sunday at 2:00 AM IST</p>

      {status && <p><strong>{status}</strong></p>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button onClick={handleDirectDownload}>
          ⬇️ Download Now (Direct)
        </button>
        <button onClick={handleTriggerS3Backup}>
          ☁️ Save to S3 Now
        </button>
        <button onClick={fetchBackupList} disabled={loading}>
          🔄 Refresh List
        </button>
      </div>

      <h3>Saved Backups ({backups.length})</h3>
      {loading ? (
        <p>Loading...</p>
      ) : backups.length === 0 ? (
        <p>No backups found. Trigger a backup to get started.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Size</th>
              <th>Created At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.fileName}>
                <td>{backup.name}</td>
                <td>{backup.sizeKB} KB</td>
                <td>{new Date(backup.createdAt).toLocaleString('en-IN')}</td>
                <td>
                  <button onClick={() => handleDownloadFromS3(backup.fileName)}>
                    ⬇️ Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BackupManager;
```

---

## 5. Recommended UI Flow

```
Backup Manager Page (Super Admin only)
│
├── [Button] "Download Now"
│     └── Calls API 1 → Direct .json.gz file download to computer
│
├── [Button] "Save to S3 Now"
│     └── Calls API 2 → Saves backup to S3, shows file name + size
│
├── [Button] "Refresh List"
│     └── Calls API 3 → Shows table of all S3 backups
│
└── [Table Row] Each backup has "Download" button
      └── Calls API 4 with fileName → Opens pre-signed URL in new tab
```

### When to use which API?

| Scenario | Use |
|----------|-----|
| Admin wants to download a copy right now | **API 1** (direct download) |
| Admin wants to save a backup before a big update | **API 2** (trigger S3 backup) |
| Admin wants to see all available backups | **API 3** (list backups) |
| Admin wants to download an old backup from S3 | **API 3** to list → **API 4** to get link |

---

## Automatic Backup Schedule

| Schedule | Time | Storage |
|----------|------|---------|
| Every Sunday | 2:00 AM IST | AWS S3 (`db-backups/` folder) |

No frontend action needed for automatic backups — they run on the server automatically.

---

*Documentation generated for EPI Backend v1.0 — Backup System*
*Last updated: February 2026*
