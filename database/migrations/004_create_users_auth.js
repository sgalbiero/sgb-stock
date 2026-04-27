const db = require('../db');
const {
  normalizarLogin,
  hashPassword,
} = require('../../src/services/auth.service');

function up() {
  console.log('Iniciando migração: 004_create_users_auth');

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT NOT NULL,
      login      TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil     TEXT NOT NULL CHECK (perfil IN ('admin', 'vendedor')),
      ativo      INTEGER DEFAULT 1,
      criado_em  TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessoes_usuario (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em  TEXT NOT NULL,
      criado_em  TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const adminLogin = normalizarLogin(process.env.DEFAULT_ADMIN_LOGIN || 'admin');
  const adminSenha = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const vendedorLogin = normalizarLogin(process.env.DEFAULT_VENDEDOR_LOGIN || 'vendedor');
  const vendedorSenha = process.env.DEFAULT_VENDEDOR_PASSWORD || 'vendedor123';

  const inserirUsuario = db.prepare(`
    INSERT OR IGNORE INTO usuarios (nome, login, senha_hash, perfil)
    VALUES (?, ?, ?, ?)
  `);

  inserirUsuario.run('Administrador', adminLogin, hashPassword(adminSenha), 'admin');
  inserirUsuario.run('Vendedor', vendedorLogin, hashPassword(vendedorSenha), 'vendedor');

  console.log('Migração concluída: 004_create_users_auth');
}

module.exports = { up };