const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const sharp    = require("sharp");
const crypto   = require("crypto");
const path     = require("path");
const {
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { s3, BUCKET } = require("../lib/s3");
const { verifyToken, requireRole } = require("../middleware/auth");

const SIGNED_URL_TTL = 3600; // 1 hour (for admin thumbnail display)
const THUMB_SIZE     = 300;
const ORIG_PREFIX    = "originals/";
const THUMB_PREFIX   = "thumbnails/";

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

// Helper: get presigned URL for a given S3 key
function signedUrl(key) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: SIGNED_URL_TTL });
}

// Helper: list ALL objects under a prefix (handles S3 pagination)
async function listAll(prefix) {
  const objects = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket:            BUCKET,
      Prefix:            prefix,
      ContinuationToken: token,
    }));
    if (res.Contents) objects.push(...res.Contents);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

// ── GET /api/images
// Returns list of images with signed thumbnail URLs.
// Authenticated users only.
router.get("/", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  try {
    const originals = await listAll(ORIG_PREFIX);

    const images = await Promise.all(
      originals
        .filter(obj => obj.Size > 0) // skip folder placeholder objects
        .map(async obj => {
          const filename    = path.basename(obj.Key);
          const thumbKey    = THUMB_PREFIX + filename;
          const thumbUrl    = await signedUrl(thumbKey);
          const proxyUrl    = `/api/images/proxy/${obj.Key}`;
          return {
            key:          obj.Key,
            filename:     filename,
            size:         obj.Size,
            lastModified: obj.LastModified,
            thumbnailUrl: thumbUrl,       // signed, for admin grid display (expires)
            proxyUrl:     proxyUrl,       // permanent proxy for embedding in posts
          };
        })
    );

    // Newest first
    images.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/images/proxy/* (PUBLIC — no auth required)
// Generates a fresh presigned URL for the given S3 key and redirects.
// Used by markdown-embedded images so readers can view them.
router.get("/proxy/*", async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: "No key provided" });
  try {
    const url = await signedUrl(key);
    res.redirect(302, url);
  } catch (err) {
    res.status(404).json({ error: "Image not found" });
  }
});

// ── POST /api/images  (multipart/form-data, field: "image")
// Uploads original + thumbnail to S3.
router.post("/", verifyToken, requireRole("admin", "contributor"), upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const ext      = path.extname(req.file.originalname).toLowerCase() || ".jpg";
  const uuid     = crypto.randomUUID();
  const basename = uuid + ext;
  const origKey  = ORIG_PREFIX  + basename;
  const thumbKey = THUMB_PREFIX + basename;

  try {
    // Generate thumbnail
    const thumbBuffer = await sharp(req.file.buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", withoutEnlargement: true })
      .toBuffer();

    // Upload original
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         origKey,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    // Upload thumbnail
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         thumbKey,
      Body:        thumbBuffer,
      ContentType: req.file.mimetype,
    }));

    const thumbUrl = await signedUrl(thumbKey);
    res.status(201).json({
      key:          origKey,
      filename:     req.file.originalname,
      size:         req.file.size,
      thumbnailUrl: thumbUrl,
      proxyUrl:     `/api/images/proxy/${origKey}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/images/*  (admin only)
router.delete("/*", verifyToken, requireRole("admin"), async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: "No key provided" });

  const filename = path.basename(key);
  const thumbKey = THUMB_PREFIX + filename;

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: thumbKey }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
