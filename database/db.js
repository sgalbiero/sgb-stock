const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure database directory exists
const dbDir = path.dirname(process.env.DB_PATH || './database/erp.db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(process.env.DB_PATH || './database/erp.db', {
  verbose: console.log
});

// Habilitar foreign keys no SQLite (desativado por padrão)
db.pragma('foreign_keys = ON');

module.exports = db;
