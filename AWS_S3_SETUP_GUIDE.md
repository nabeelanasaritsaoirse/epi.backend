# AWS S3 Setup Guide for Image Uploads

## 🚨 Issue Fixed
Banner images were not uploading to S3 due to:
1. **Missing .env file** with AWS credentials
2. **ACL permission issue** - Modern S3 buckets have ACL disabled by default
3. **Missing error logging** - Hard to debug upload failures

## ✅ Fixes Applied

### 1. Removed ACL Parameter
- **File**: `services/awsUploadService.js`
- **Change**: Removed `ACL: 'public-read'` from S3 upload params
- **Reason**: Modern S3 buckets use bucket policies instead of ACLs

### 2. Added AWS Credential Validation
- Added startup warnings if AWS credentials are missing
- Added detailed error logging for S3 upload failures
- Added helpful error messages for common issues

### 3. Created .env.example
- Template file showing all required environment variables

---

## 📋 Setup Instructions

### Step 1: Create .env File

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Step 2: Add Your AWS Credentials

Open `.env` and add your AWS credentials:

```env
# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-actual-access-key-id
AWS_SECRET_ACCESS_KEY=your-actual-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

### Step 3: Configure S3 Bucket for Public Access

Since we removed the ACL parameter, you need to configure your S3 bucket policy:

1. **Go to AWS S3 Console**
2. **Select your bucket**
3. **Go to Permissions tab**
4. **Edit Bucket Policy** and add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

**Replace `your-bucket-name` with your actual bucket name!**

5. **Disable "Block all public access"** (if needed for public images)
   - Go to Permissions → Block public access → Edit
   - Uncheck "Block all public access"
   - Save changes

### Step 4: Configure CORS (if accessing from browser)

Add CORS configuration to your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Step 5: Verify IAM User Permissions

Your IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

---

## 🧪 Testing

### Test Upload
After setup, restart your server:
```bash
npm start
```

Look for this message in console:
```
✅ AWS S3 Service initialized
   Region: ap-south-1
   Bucket: your-bucket-name
   Credentials: ✓ Set
```

### Test Banner Upload API

```bash
POST /api/banners
Headers:
  Authorization: Bearer <admin-access-token>
  Content-Type: multipart/form-data

Body (form-data):
  title: Test Banner
  image: <select-image-file>
  description: Test description
  platform: both
```

---

## 🐛 Troubleshooting

### Error: "AWS credentials not found"
- **Solution**: Create `.env` file and add AWS credentials

### Error: "Access denied to S3 bucket"
- **Solution**: Check IAM user permissions and bucket policy

### Error: "S3 bucket does not exist"
- **Solution**: Verify `AWS_S3_BUCKET_NAME` in `.env` matches your actual bucket name

### Images upload but can't be accessed
- **Solution**: Check bucket policy and public access settings

### Error: "The bucket does not allow ACLs"
- **Solution**: Already fixed! ACL parameter removed from code

---

## 📝 Notes

- **Security**: Never commit `.env` file to git (already in `.gitignore`)
- **Production**: Use IAM roles instead of access keys when deploying to AWS
- **Bucket Policy**: Only make objects public if needed. For private images, use signed URLs
- **Region**: Make sure `AWS_REGION` matches your bucket's region

---

## 🔗 Useful Links

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/)
- [S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
