// ============================================================
// Uploads Routes — File upload to S3 with presigned URLs
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuid } = require('uuid');

// S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET || 'costlens-uploads';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// Multer for multipart uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not supported'));
  }
});

// ─── UPLOAD FILE ───
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const fileId = uuid();
  const ext = req.file.originalname.split('.').pop();
  const key = `uploads/${req.user.id}/${fileId}.${ext}`;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    const [record] = await db('file_uploads').insert({
      user_id: req.user.id,
      original_name: req.file.originalname,
      storage_url: `s3://${BUCKET}/${key}`,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      upload_context: req.body.context || null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }).returning('*');

    res.json({
      fileId: record.id,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: key
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// ─── GET PRESIGNED DOWNLOAD URL ───
router.get('/download/:fileId', requireAuth, async (req, res) => {
  const file = await db('file_uploads')
    .where({ id: req.params.fileId, user_id: req.user.id })
    .first();
  if (!file) return res.status(404).json({ error: 'File not found' });

  const key = file.storage_url.replace(`s3://${BUCKET}/`, '');
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET, Key: key
  }), { expiresIn: 3600 });

  res.json({ downloadUrl: url, fileName: file.original_name });
});

module.exports = router;
