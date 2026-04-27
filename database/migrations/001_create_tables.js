const db = require('../db');

function up() {
  console.log('Iniciando migração: 001_create_tables');

  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS fornecedores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT NOT NULL,
      telefone    TEXT,
      endereco    TEXT,
      cidade      TEXT,
      cep         TEXT,
      observacoes TEXT,
      ativo       INTEGER DEFAULT 1,
      criado_em   TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      sku       TEXT NOT NULL UNIQUE,
      nome      TEXT NOT NULL,
      custo     REAL NOT NULL DEFAULT 0,
      preco     REAL NOT NULL DEFAULT 0,
      ativo     INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS produto_variacoes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id   INTEGER NOT NULL REFERENCES produtos(id),
      tamanho      TEXT NOT NULL,
      cor          TEXT NOT NULL,
      sku_variacao TEXT,
      ativo        INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS locais_estoque (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS estoque (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      variacao_id INTEGER NOT NULL REFERENCES produto_variacoes(id),
      local_id    INTEGER NOT NULL REFERENCES locais_estoque(id),
      quantidade  INTEGER NOT NULL DEFAULT 0,
      UNIQUE(variacao_id, local_id)
    );

    CREATE TABLE IF NOT EXISTS produto_fornecedores (
      produto_id    INTEGER NOT NULL REFERENCES produtos(id),
      fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
      PRIMARY KEY (produto_id, fornecedor_id)
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT NOT NULL,
      telefone  TEXT,
      endereco  TEXT,
      bairro    TEXT,
      cidade    TEXT,
      cep       TEXT,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id      INTEGER REFERENCES clientes(id),
      total           REAL NOT NULL,
      desconto        REAL DEFAULT 0,
      forma_pagamento TEXT NOT NULL,
      status          TEXT DEFAULT 'concluida',
      observacoes     TEXT,
      criado_em       TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id    INTEGER NOT NULL REFERENCES vendas(id),
      variacao_id INTEGER NOT NULL REFERENCES produto_variacoes(id),
      quantidade  INTEGER NOT NULL,
      preco_unit  REAL NOT NULL,
      custo_unit  REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorias_financeiras (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo         TEXT NOT NULL,
      descricao    TEXT NOT NULL,
      valor        REAL NOT NULL,
      categoria_id INTEGER REFERENCES categorias_financeiras(id),
      venda_id     INTEGER REFERENCES vendas(id),
      status       TEXT DEFAULT 'pendente',
      vencimento   TEXT,
      pago_em      TEXT,
      observacoes  TEXT,
      criado_em    TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `;

  db.exec(createTablesSQL);
  console.log('Migração concluída: 001_create_tables');
}

module.exports = { up };
