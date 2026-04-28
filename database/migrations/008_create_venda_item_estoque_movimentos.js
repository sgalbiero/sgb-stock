const db = require('../db');

function up() {
  console.log('Iniciando migração: 008_create_venda_item_estoque_movimentos');

  db.exec(`
    CREATE TABLE IF NOT EXISTS venda_item_estoque_movimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_item_id INTEGER NOT NULL REFERENCES venda_itens(id) ON DELETE CASCADE,
      local_id INTEGER NOT NULL REFERENCES locais_estoque(id),
      quantidade INTEGER NOT NULL,
      criado_em TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(venda_item_id, local_id)
    );

    CREATE INDEX IF NOT EXISTS idx_venda_item_estoque_movimentos_venda_item
      ON venda_item_estoque_movimentos(venda_item_id);
  `);

  console.log('Migração concluída: 008_create_venda_item_estoque_movimentos');
}

module.exports = { up };