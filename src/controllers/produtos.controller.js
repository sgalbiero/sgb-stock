const db = require('../../database/db');
const { registrarEvento } = require('../services/audit.service');

function normalizarIdsFornecedores(fornecedorIds) {
  if (!Array.isArray(fornecedorIds)) return [];

  return [...new Set(
    fornecedorIds
      .map(id => Number.parseInt(id, 10))
      .filter(Number.isInteger)
  )];
}

function sincronizarFornecedores(produtoId, fornecedorIds) {
  const deleteStmt = db.prepare('DELETE FROM produto_fornecedores WHERE produto_id = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO produto_fornecedores (produto_id, fornecedor_id) VALUES (?, ?)');

  deleteStmt.run(produtoId);
  for (const fornecedorId of fornecedorIds) {
    insertStmt.run(produtoId, fornecedorId);
  }
}

function listarProdutosPorStatus(ativo) {
  return db.prepare(`
    SELECT 
      p.*,
      COALESCE(GROUP_CONCAT(f.nome, ' | '), '') as fornecedor_nomes
    FROM produtos p
    LEFT JOIN produto_fornecedores pf ON pf.produto_id = p.id
    LEFT JOIN fornecedores f ON f.id = pf.fornecedor_id
    WHERE p.ativo = ?
    GROUP BY p.id
    ORDER BY p.nome ASC
  `).all(ativo);
}

exports.listar = (req, res, next) => {
  try {
    const produtos = listarProdutosPorStatus(1);
    res.json(produtos);
  } catch (error) {
    next(error);
  }
};

exports.listarInativos = (req, res, next) => {
  try {
    const produtos = listarProdutosPorStatus(0);
    res.json(produtos);
  } catch (error) {
    next(error);
  }
};

exports.obter = (req, res, next) => {
  try {
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const variacoes = db.prepare('SELECT * FROM produto_variacoes WHERE produto_id = ? AND ativo = 1').all(req.params.id);
    const fornecedores = db.prepare(`
      SELECT f.id, f.nome
      FROM fornecedores f
      JOIN produto_fornecedores pf ON pf.fornecedor_id = f.id
      WHERE pf.produto_id = ?
      ORDER BY f.nome ASC
    `).all(req.params.id);
    
    // Buscar estoque para cada variação
    for (let variacao of variacoes) {
      variacao.estoque = db.prepare(`
        SELECT e.quantidade, l.nome as local 
        FROM estoque e
        JOIN locais_estoque l ON e.local_id = l.id
        WHERE e.variacao_id = ?
      `).all(variacao.id);
    }

    res.json({ ...produto, variacoes, fornecedores });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { sku, nome, custo, preco, variacoes, fornecedor_ids } = req.body;
    if (!sku || !nome) return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });

    const fornecedorIds = normalizarIdsFornecedores(fornecedor_ids);

    const transaction = db.transaction(() => {
      const stmt = db.prepare('INSERT INTO produtos (sku, nome, custo, preco) VALUES (?, ?, ?, ?)');
      const info = stmt.run(sku, nome, custo || 0, preco || 0);
      const produtoId = info.lastInsertRowid;

      sincronizarFornecedores(produtoId, fornecedorIds);

      if (variacoes && Array.isArray(variacoes)) {
        const insertVar = db.prepare('INSERT INTO produto_variacoes (produto_id, tamanho, cor, sku_variacao) VALUES (?, ?, ?, ?)');
        for (const v of variacoes) {
          insertVar.run(produtoId, v.tamanho, v.cor, v.sku_variacao || null);
        }
      }
      return produtoId;
    });

    const id = transaction();

    registrarEvento(req, {
      acao: 'produto.criado',
      entidade: 'produto',
      entidadeId: id,
      descricao: `Produto ${nome} criado`,
      detalhes: { sku, variacoes: Array.isArray(variacoes) ? variacoes.length : 0, fornecedores: fornecedorIds.length },
    });

    res.status(201).json({ id, mensagem: 'Produto criado com sucesso' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'SKU já cadastrado' });
    }
    next(error);
  }
};

exports.atualizar = (req, res, next) => {
  try {
    const { sku, nome, custo, preco, fornecedor_ids } = req.body;
    if (!sku || !nome) return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });

    const fornecedorIds = normalizarIdsFornecedores(fornecedor_ids);

    const transaction = db.transaction(() => {
      const stmt = db.prepare('UPDATE produtos SET sku=?, nome=?, custo=?, preco=? WHERE id=?');
      const info = stmt.run(sku, nome, custo, preco, req.params.id);

      if (info.changes === 0) return info;
      sincronizarFornecedores(req.params.id, fornecedorIds);
      return info;
    });

    const info = transaction();
    if (info.changes === 0) return res.status(404).json({ error: 'Produto não encontrado' });

    registrarEvento(req, {
      acao: 'produto.atualizado',
      entidade: 'produto',
      entidadeId: Number(req.params.id),
      descricao: `Produto ${nome} atualizado`,
      detalhes: { sku, fornecedores: fornecedorIds.length },
    });

    res.json({ mensagem: 'Produto atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.desativar = (req, res, next) => {
  try {
    const stmt = db.prepare('UPDATE produtos SET ativo=0 WHERE id=?');
    const info = stmt.run(req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'Produto não encontrado' });

    registrarEvento(req, {
      acao: 'produto.desativado',
      entidade: 'produto',
      entidadeId: Number(req.params.id),
      descricao: `Produto #${req.params.id} desativado`,
    });

    res.json({ mensagem: 'Produto desativado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.recuperar = (req, res, next) => {
  try {
    const stmt = db.prepare('UPDATE produtos SET ativo=1 WHERE id=?');
    const info = stmt.run(req.params.id);

    if (info.changes === 0) return res.status(404).json({ error: 'Produto não encontrado' });

    registrarEvento(req, {
      acao: 'produto.recuperado',
      entidade: 'produto',
      entidadeId: Number(req.params.id),
      descricao: `Produto #${req.params.id} recuperado`,
    });

    res.json({ mensagem: 'Produto recuperado com sucesso' });
  } catch (error) {
    next(error);
  }
};

// --- Variações ---
exports.adicionarVariacao = (req, res, next) => {
  try {
    const { tamanho, cor, sku_variacao } = req.body;
    const stmt = db.prepare('INSERT INTO produto_variacoes (produto_id, tamanho, cor, sku_variacao) VALUES (?, ?, ?, ?)');
    const info = stmt.run(req.params.id, tamanho, cor, sku_variacao);

    registrarEvento(req, {
      acao: 'produto.variacao_criada',
      entidade: 'produto_variacao',
      entidadeId: info.lastInsertRowid,
      descricao: `Variação adicionada ao produto #${req.params.id}`,
      detalhes: { produto_id: Number(req.params.id), tamanho, cor, sku_variacao },
    });

    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Variação adicionada' });
  } catch (error) {
    next(error);
  }
};

exports.desativarVariacao = (req, res, next) => {
  try {
    const stmt = db.prepare('UPDATE produto_variacoes SET ativo=0 WHERE id=?');
    const info = stmt.run(req.params.variacao_id);
    if (info.changes === 0) return res.status(404).json({ error: 'Variação não encontrada' });

    registrarEvento(req, {
      acao: 'produto.variacao_desativada',
      entidade: 'produto_variacao',
      entidadeId: Number(req.params.variacao_id),
      descricao: `Variação #${req.params.variacao_id} desativada`,
    });

    res.json({ mensagem: 'Variação desativada' });
  } catch (error) {
    next(error);
  }
};

// --- Estoque ---
exports.entradaEstoque = (req, res, next) => {
  try {
    const { local_id, quantidade } = req.body;
    const variacao_id = req.params.variacao_id;
    if (!local_id || quantidade === undefined) return res.status(400).json({ error: 'Local e quantidade são obrigatórios' });

    const transaction = db.transaction(() => {
      // Verifica se já existe o registro de estoque para este local
      const existe = db.prepare('SELECT quantidade FROM estoque WHERE variacao_id = ? AND local_id = ?').get(variacao_id, local_id);
      
      if (existe) {
        db.prepare('UPDATE estoque SET quantidade = quantidade + ? WHERE variacao_id = ? AND local_id = ?').run(quantidade, variacao_id, local_id);
      } else {
        db.prepare('INSERT INTO estoque (variacao_id, local_id, quantidade) VALUES (?, ?, ?)').run(variacao_id, local_id, quantidade);
      }
    });

    transaction();

    registrarEvento(req, {
      acao: 'estoque.entrada',
      entidade: 'estoque',
      descricao: `Entrada de estoque registrada para a variação #${variacao_id}`,
      detalhes: { variacao_id: Number(variacao_id), local_id: Number(local_id), quantidade: Number(quantidade) },
    });

    res.json({ mensagem: 'Estoque atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};
