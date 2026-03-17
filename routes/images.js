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
const serverError = require("../lib/errors");

const SIGNED_URL_TTL = 3600; // 1 hour (for admin thumbnail display)
const THUMB_SIZE     = 300;
const CARD_SIZE      = 800;
const ORIG_PREFIX    = process.env.AWS_S3_IMAGES_PREFIX    || "images/";
const THUMB_PREFIX   = process.env.AWS_S3_THUMBNAILS_PREFIX || "thumbnails/";
const CARD_PREFIX    = process.env.AWS_S3_CARDS_PREFIX      || "cards/";

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
    const query     = (req.query.q || "").toLowerCase().trim();
    const terms     = query ? query.split(/\s+/) : [];
    const originals = await listAll(ORIG_PREFIX);

    const images = await Promise.all(
      originals
        .filter(obj => {
          if (obj.Size === 0) return false; // skip folder placeholder objects
          if (!terms.length) return true;
          const name = path.basename(obj.Key).toLowerCase();
          return terms.every(term => name.includes(term));
        })
        .map(async obj => {
          const filename     = path.basename(obj.Key);
          const thumbKey     = THUMB_PREFIX + filename;
          const thumbUrl     = await signedUrl(thumbKey);
          const proxyUrl     = `/api/images/proxy/${obj.Key}`;
          const cardProxyUrl = `/api/images/proxy/${CARD_PREFIX}${filename}`;
          const thumbProxyUrl = `/api/images/proxy/${THUMB_PREFIX}${filename}`;
          return {
            key:          obj.Key,
            filename:     filename,
            size:         obj.Size,
            lastModified: obj.LastModified,
            thumbnailUrl:  thumbUrl,       // signed, for admin grid display (expires)
            proxyUrl:      proxyUrl,       // permanent proxy for full-size image
            cardProxyUrl:  cardProxyUrl,   // permanent proxy for card-size image
            thumbProxyUrl: thumbProxyUrl,  // permanent proxy for thumbnail
          };
        })
    );

    // Newest first
    images.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(images);
  } catch (err) {
    return serverError(res, err);
  }
});

// ── GET /api/images/presign?key=... — return presigned URL as JSON (authenticated)
router.get("/presign", verifyToken, requireRole("admin", "contributor"), async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "key is required" });
  try {
    const url = await signedUrl(key);
    res.json({ url });
  } catch (err) {
    return serverError(res, err);
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
  const cardKey  = CARD_PREFIX  + basename;

  try {
    // Generate thumbnail and card image
    const [thumbBuffer, cardBuffer] = await Promise.all([
      sharp(req.file.buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", withoutEnlargement: true })
        .toBuffer(),
      sharp(req.file.buffer)
        .resize(CARD_SIZE, CARD_SIZE, { fit: "inside", withoutEnlargement: true })
        .toBuffer(),
    ]);

    // Upload original, thumbnail, and card image
    await Promise.all([
      s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         origKey,
        Body:        req.file.buffer,
        ContentType: req.file.mimetype,
      })),
      s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         thumbKey,
        Body:        thumbBuffer,
        ContentType: req.file.mimetype,
      })),
      s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         cardKey,
        Body:        cardBuffer,
        ContentType: req.file.mimetype,
      })),
    ]);

    const thumbUrl = await signedUrl(thumbKey);
    res.status(201).json({
      key:          origKey,
      filename:     req.file.originalname,
      size:         req.file.size,
      thumbnailUrl: thumbUrl,
      cardProxyUrl: `/api/images/proxy/${cardKey}`,
      proxyUrl:     `/api/images/proxy/${origKey}`,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// ── DELETE /api/images/*  (admin only)
router.delete("/*", verifyToken, requireRole("admin"), async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).json({ error: "No key provided" });

  const filename = path.basename(key);
  const thumbKey = THUMB_PREFIX + filename;
  const cardKey  = CARD_PREFIX  + filename;

  try {
    await Promise.all([
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: thumbKey })),
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cardKey })),
    ]);
    res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
