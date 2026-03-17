module.exports = function serverError(res, err) {
  console.error(err);
  const msg = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
  res.status(500).json({ error: msg });
};
