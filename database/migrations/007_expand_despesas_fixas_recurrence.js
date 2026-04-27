const db = require('../db');

function colunaExiste(tabela, coluna) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all();
  return colunas.some(item => item.name === coluna);
}

exports.up = () => {
  console.log('Iniciando migração: 007_expand_despesas_fixas_recurrence');

  if (!colunaExiste('despesas_fixas', 'periodicidade')) {
    db.exec("ALTER TABLE despesas_fixas ADD COLUMN periodicidade TEXT DEFAULT 'mensal'");
  }

  if (!colunaExiste('despesas_fixas', 'intervalo_repeticao')) {
    db.exec('ALTER TABLE despesas_fixas ADD COLUMN intervalo_repeticao INTEGER DEFAULT 1');
  }

  if (!colunaExiste('despesas_fixas', 'data_base')) {
    db.exec('ALTER TABLE despesas_fixas ADD COLUMN data_base TEXT');
  }

  db.prepare(`
    UPDATE despesas_fixas
    SET periodicidade = COALESCE(periodicidade, 'mensal'),
        intervalo_repeticao = COALESCE(intervalo_repeticao, 1)
  `).run();

  const despesas = db.prepare('SELECT id, dia_vencimento, data_base FROM despesas_fixas').all();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');

  const updateDataBase = db.prepare('UPDATE despesas_fixas SET data_base = ? WHERE id = ?');
  for (const despesa of despesas) {
    if (despesa.data_base) continue;
    const dia = String(Math.min(Math.max(Number(despesa.dia_vencimento) || 1, 1), 28)).padStart(2, '0');
    updateDataBase.run(`${ano}-${mes}-${dia}`, despesa.id);
  }

  console.log('Migração concluída: 007_expand_despesas_fixas_recurrence');
};