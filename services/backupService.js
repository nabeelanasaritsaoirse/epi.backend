const mongoose = require('mongoose');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const zlib = require('zlib');

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'company-video-storage-prod';
const BACKUP_FOLDER = 'db-backups';

const getS3Client = () => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }
  return new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
};

const checkDbConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected. Cannot perform backup.');
  }
};

const exportAllCollections = async () => {
  checkDbConnection();

  const db = mongoose.connection.db;
  const collections = {};
  const existingCollections = await db.listCollections().toArray();

  for (const col of existingCollections) {
    try {
      const docs = await db.collection(col.name).find({}).toArray();
      collections[col.name] = docs;
    } catch (err) {
      console.error(`[Backup] Failed to export collection "${col.name}":`, err.message);
      collections[col.name] = { _error: err.message };
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    databaseName: mongoose.connection.name,
    totalCollections: Object.keys(collections).length,
    collections
  };
};

const compressData = (jsonString) => {
  return new Promise((resolve, reject) => {
    zlib.gzip(jsonString, { level: zlib.constants.Z_BEST_COMPRESSION }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const uploadBackupToS3 = async (backupData) => {
  const s3Client = getS3Client();
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${BACKUP_FOLDER}/backup_${date}.json.gz`;

  // No pretty print - saves memory on large databases
  const jsonString = JSON.stringify(backupData);
  const compressed = await compressData(jsonString);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: compressed,
    ContentType: 'application/gzip',
    ContentEncoding: 'gzip',
    Metadata: {
      'backup-date': new Date().toISOString(),
      'collections-count': String(backupData.totalCollections),
      'database-name': backupData.databaseName || 'epi'
    }
  }));

  return { fileName, size: compressed.length };
};

const listBackups = async () => {
  const s3Client = getS3Client();

  const result = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: BACKUP_FOLDER + '/',
    MaxKeys: 100
  }));

  return (result.Contents || [])
    .filter(f => f.Key !== BACKUP_FOLDER + '/' && f.Key.endsWith('.json.gz'))
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .map(f => ({
      fileName: f.Key,
      name: f.Key.replace(BACKUP_FOLDER + '/', ''),
      sizeKB: parseFloat((f.Size / 1024).toFixed(2)),
      createdAt: f.LastModified
    }));
};

const getBackupDownloadUrl = async (fileName) => {
  // Security: only allow files inside the backup folder
  if (!fileName || !fileName.startsWith(BACKUP_FOLDER + '/') || !fileName.endsWith('.json.gz')) {
    throw new Error('Invalid backup file name.');
  }

  // Prevent path traversal
  if (fileName.includes('..') || fileName.includes('//')) {
    throw new Error('Invalid backup file name.');
  }

  const s3Client = getS3Client();
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileName });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const runBackup = async () => {
  console.log('[Backup] Starting database backup...');
  const data = await exportAllCollections();
  const { fileName, size } = await uploadBackupToS3(data);
  console.log(`[Backup] ✅ Saved: ${fileName} (${(size / 1024).toFixed(2)} KB, ${data.totalCollections} collections)`);
  return { fileName, sizeKB: parseFloat((size / 1024).toFixed(2)), collectionCount: data.totalCollections, exportedAt: data.exportedAt };
};

module.exports = { exportAllCollections, compressData, runBackup, listBackups, getBackupDownloadUrl };
