const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'company-video-storage-prod';

const uploadToS3 = async (fileBuffer, folder, fileName) => {
  try {
    if (!fileBuffer) {
      throw new Error('File buffer is required');
    }

    if (!folder) {
      throw new Error('Folder path is required');
    }

    if (!fileName) {
      throw new Error('File name is required');
    }

    const key = `${folder}${fileName}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Construct the S3 URL
    const region = process.env.AWS_REGION || 'ap-south-1';
    const s3Url = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;

    return s3Url;
  } catch (error) {
    console.error('Error in uploadToS3:', error);
    throw new Error(`S3 Upload Error: ${error.message}`);
  }
};

const deleteImageFromS3 = async (imageUrl) => {
  try {
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    if (!imageUrl.includes(BUCKET_NAME)) {
      throw new Error('Invalid S3 URL');
    }

    const urlParts = imageUrl.split('.com/');
    if (urlParts.length < 2) {
      throw new Error('Invalid S3 URL format');
    }

    const key = urlParts[1];

    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    
    return true;
  } catch (error) {
    console.error('Error in deleteImageFromS3:', error);
    throw new Error(`S3 Delete Error: ${error.message}`);
  }
};

const resizeImage = async (fileBuffer, width = 480) => {
  try {
    if (!fileBuffer) {
      throw new Error('File buffer is required for resizing');
    }

    if (typeof width !== 'number' || width <= 0) {
      throw new Error('Invalid width for image resize');
    }

    const resizedBuffer = await sharp(fileBuffer)
      .resize(width, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    if (!resizedBuffer) {
      throw new Error('Failed to resize image');
    }

    return resizedBuffer;
  } catch (error) {
    console.error('Error in resizeImage:', error);
    throw new Error(`Image Resize Error: ${error.message}`);
  }
};

const uploadSingleFileToS3 = async (file, folder, resizeWidth = 480) => {
  try {
    if (!file) {
      throw new Error('File is required');
    }

    if (!file.buffer) {
      throw new Error('File buffer not found');
    }

    if (!folder) {
      throw new Error('Folder path is required');
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error('Invalid file type. Only jpg, jpeg, png, webp allowed');
    }

    const resizedBuffer = await resizeImage(file.buffer, resizeWidth);

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    const s3Url = await uploadToS3(resizedBuffer, folder, fileName);

    return {
      url: s3Url,
      key: `${folder}${fileName}`,
      mimeType: 'image/jpeg',
      size: resizedBuffer.length,
      originalName: file.originalname
    };
  } catch (error) {
    console.error('Error in uploadSingleFileToS3:', error);
    throw new Error(`Upload Single File Error: ${error.message}`);
  }
};

const uploadMultipleFilesToS3 = async (files, folder, resizeWidth = 480) => {
  try {
    if (!files || files.length === 0) {
      throw new Error('Files array is required');
    }

    if (!folder) {
      throw new Error('Folder path is required');
    }

    const uploadPromises = files.map(file => uploadSingleFileToS3(file, folder, resizeWidth));

    const results = await Promise.all(uploadPromises);

    return results; // array of {url,key,mimeType,size,originalName}
  } catch (error) {
    console.error('Error in uploadMultipleFilesToS3:', error);
    throw new Error(`Upload Multiple Files Error: ${error.message}`);
  }
};

const deleteMultipleImagesFromS3 = async (imageUrls) => {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('Image URLs array is required');
    }

    const deletePromises = imageUrls.map(url => deleteImageFromS3(url));

    await Promise.all(deletePromises);

    return true;
  } catch (error) {
    console.error('Error in deleteMultipleImagesFromS3:', error);
    throw new Error(`Delete Multiple Images Error: ${error.message}`);
  }
};

module.exports = {
  uploadToS3,
  deleteImageFromS3,
  resizeImage,
  uploadSingleFileToS3,
  uploadMultipleFilesToS3,
  deleteMultipleImagesFromS3
};