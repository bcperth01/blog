const express  = require("express");
const router   = express.Router();
const zlib     = require("zlib");
const { spawn } = require("child_process");
const {
  PutObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const { s3, BUCKET } = require("../lib/s3");
const { verifyToken, requireRole } = require("../middleware/auth");
const serverError = require("../lib/errors");

const BACKUP_PREFIX = "backups/";

// GET /api/backups — list recent backups from S3
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: BACKUP_PREFIX,
    }));

    const backups = (result.Contents || [])
      .filter(obj => obj.Size > 0)
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map(obj => ({
        key:          obj.Key,
        filename:     obj.Key.split("/").pop(),
        size:         obj.Size,
        lastModified: obj.LastModified,
      }));

    res.json(backups);
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/backups — trigger a backup now
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const key = `${BACKUP_PREFIX}blogdb_${timestamp}.sql.gz`;

    // Run pg_dump connecting to the db service, pipe through gzip
    const dump = spawn("pg_dump", [
      "-h", process.env.DB_HOST     || "db",
      "-p", process.env.DB_PORT     || "5432",
      "-U", process.env.DB_USER     || "bloguser",
            process.env.DB_NAME     || "blogdb",
    ], {
      env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || "blogpass" },
    });

    const gzip   = zlib.createGzip();
    const chunks = [];

    dump.stdout.pipe(gzip);
    gzip.on("data", chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      let stderr = "";
      dump.stderr.on("data", d => { stderr += d.toString(); });
      dump.on("error", reject);
      gzip.on("end", resolve);
      gzip.on("error", reject);
      dump.on("close", code => { if (code !== 0) reject(new Error(`pg_dump exited ${code}: ${stderr}`)); });
    });

    const body = Buffer.concat(chunks);

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        body,
      ContentType: "application/gzip",
    }));

    res.json({ ok: true, key, filename: key.split("/").pop(), size: body.length });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
