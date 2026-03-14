const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 5432,
  user:     process.env.DB_USER     || "bloguser",
  password: process.env.DB_PASSWORD || "blogpass",
  database: process.env.DB_NAME     || "blogdb",
});

module.exports = pool;
