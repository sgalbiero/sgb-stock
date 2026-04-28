const migration1 = require('./001_create_tables');
const migration2 = require('./002_seed_categories');
const migration3 = require('./003_add_venda_pagamento_status');
const migration4 = require('./004_create_users_auth');
const migration5 = require('./005_create_audit_log');
const migration6 = require('./006_create_despesas_fixas');
const migration7 = require('./007_expand_despesas_fixas_recurrence');
const migration8 = require('./008_create_venda_item_estoque_movimentos');

console.log('--- Iniciando execução de migrações ---');
try {
  migration1.up();
  migration2.up();
  migration3.up();
  migration4.up();
  migration5.up();
  migration6.up();
  migration7.up();
  migration8.up();
  console.log('--- Migrações executadas com sucesso ---');
} catch (error) {
  console.error('Erro ao executar migrações:', error);
}
