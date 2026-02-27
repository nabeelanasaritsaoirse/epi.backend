const { exportAllCollections, compressData, runBackup, listBackups, getBackupDownloadUrl } = require('../services/backupService');

const isProd = process.env.NODE_ENV === 'production';

const sendError = (res, status, message, err) => {
  console.error(`[Backup] ${message}:`, err);
  res.status(status).json({
    success: false,
    message,
    ...(isProd ? {} : { error: err.message })
  });
};

// Download full DB backup directly as .json.gz file
exports.downloadBackup = async (req, res) => {
  try {
    console.log(`[Backup] Download triggered by: ${req.user?.email}`);

    const data = await exportAllCollections();
    const jsonString = JSON.stringify(data);
    const compressed = await compressData(jsonString);

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `epi_backup_${date}.json.gz`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', compressed.length);
    res.setHeader('X-Backup-Collections', String(data.totalCollections));
    res.send(compressed);

  } catch (err) {
    sendError(res, 500, 'Backup download failed', err);
  }
};

// Save backup to S3 manually
exports.triggerS3Backup = async (req, res) => {
  try {
    console.log(`[Backup] S3 backup triggered by: ${req.user?.email}`);
    const result = await runBackup();
    res.json({ success: true, message: 'Backup saved to S3 successfully', data: result });
  } catch (err) {
    sendError(res, 500, 'S3 backup failed', err);
  }
};

// List all backups stored in S3
exports.listS3Backups = async (_req, res) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, count: backups.length, backups });
  } catch (err) {
    sendError(res, 500, 'Failed to list backups', err);
  }
};

// Get signed download URL for a specific S3 backup
exports.getS3BackupUrl = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ success: false, message: 'fileName query parameter is required' });
    }

    const url = await getBackupDownloadUrl(fileName);
    res.json({ success: true, downloadUrl: url, expiresIn: '1 hour' });
  } catch (err) {
    const isInvalidName = err.message === 'Invalid backup file name.';
    sendError(res, isInvalidName ? 400 : 500, err.message, err);
  }
};
