// ============================================================
// Database Configuration — Knex.js + PostgreSQL
// ============================================================

const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10
  },
  // Convert snake_case DB columns to camelCase in JS
  postProcessResponse: (result) => {
    if (Array.isArray(result)) return result.map(row => toCamelCase(row));
    return toCamelCase(result);
  },
  // Convert camelCase JS keys to snake_case for DB
  wrapIdentifier: (value, origImpl) => {
    return origImpl(toSnakeCase(value));
  }
});

function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = {};
  for (const [key, val] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    newObj[camelKey] = val;
  }
  return newObj;
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

module.exports = db;
