const express = require('express');
const router = express.Router();
const { verifyToken, isSuperAdmin } = require('../middlewares/auth');
const {
  downloadBackup,
  triggerS3Backup,
  listS3Backups,
  getS3BackupUrl
} = require('../controllers/backupController');

// All routes: Super Admin only
router.use(verifyToken, isSuperAdmin);

// GET  /api/admin/backup/download  → Download full DB as .json.gz file
router.get('/download', downloadBackup);

// POST /api/admin/backup/trigger   → Save backup to S3 now
router.post('/trigger', triggerS3Backup);

// GET  /api/admin/backup/list      → List all S3 backups
router.get('/list', listS3Backups);

// GET  /api/admin/backup/url?fileName=db-backups/backup_xxx.json.gz → Get download URL
router.get('/url', getS3BackupUrl);

module.exports = router;
