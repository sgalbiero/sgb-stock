const db = require('../db');

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some(column => column.name === columnName);
}

function up() {
  console.log('Iniciando migração: 003_add_venda_pagamento_status');

  if (!columnExists('vendas', 'status_pagamento')) {
    db.exec("ALTER TABLE vendas ADD COLUMN status_pagamento TEXT DEFAULT 'pago'");
  }

  db.prepare(`
    UPDATE vendas
    SET status_pagamento = COALESCE((
      SELECT CASE
        WHEN lf.status = 'pago' THEN 'pago'
        ELSE 'aguardando_pagamento'
      END
      FROM lancamentos_financeiros lf
      WHERE lf.venda_id = vendas.id
      ORDER BY lf.id DESC
      LIMIT 1
    ), 'pago')
    WHERE status_pagamento IS NULL OR status_pagamento = ''
  `).run();

  console.log('Migração concluída: 003_add_venda_pagamento_status');
}

module.exports = { up };