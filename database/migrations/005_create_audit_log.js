const db = require('../db');

exports.up = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auditoria_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      usuario_nome TEXT,
      usuario_login TEXT,
      usuario_perfil TEXT,
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      entidade_id INTEGER,
      descricao TEXT NOT NULL,
      detalhes_json TEXT,
      ip TEXT,
      user_agent TEXT,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria_eventos(criado_em DESC);
    CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria_eventos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria_eventos(entidade);
    CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria_eventos(acao);
  `);
};