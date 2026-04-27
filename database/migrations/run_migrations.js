const migration1 = require('./001_create_tables');
const migration2 = require('./002_seed_categories');
const migration3 = require('./003_add_venda_pagamento_status');

console.log('--- Iniciando execução de migrações ---');
try {
  migration1.up();
  migration2.up();
  migration3.up();
  console.log('--- Migrações executadas com sucesso ---');
} catch (error) {
  console.error('Erro ao executar migrações:', error);
}
