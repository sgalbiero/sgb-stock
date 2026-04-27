const db = require('../db');

function colunaExiste(tabela, coluna) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all();
  return colunas.some(item => item.name === coluna);
}

exports.up = () => {
  console.log('Iniciando migração: 006_create_despesas_fixas');

  db.exec(`
    CREATE TABLE IF NOT EXISTS despesas_fixas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria_id INTEGER REFERENCES categorias_financeiras(id),
      dia_vencimento INTEGER NOT NULL,
      observacoes TEXT,
      ativa INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  if (!colunaExiste('lancamentos_financeiros', 'despesa_fixa_id')) {
    db.exec('ALTER TABLE lancamentos_financeiros ADD COLUMN despesa_fixa_id INTEGER REFERENCES despesas_fixas(id)');
  }

  if (!colunaExiste('lancamentos_financeiros', 'referencia_mes')) {
    db.exec('ALTER TABLE lancamentos_financeiros ADD COLUMN referencia_mes TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lancamentos_despesa_fixa ON lancamentos_financeiros(despesa_fixa_id, referencia_mes);
    CREATE INDEX IF NOT EXISTS idx_lancamentos_vencimento_status ON lancamentos_financeiros(status, vencimento);
  `);

  console.log('Migração concluída: 006_create_despesas_fixas');
};