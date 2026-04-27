const db = require('../../database/db');

exports.listar = (req, res, next) => {
  try {
    const produtos = db.prepare('SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome ASC').all();
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
    
    // Buscar estoque para cada variação
    for (let variacao of variacoes) {
      variacao.estoque = db.prepare(`
        SELECT e.quantidade, l.nome as local 
        FROM estoque e
        JOIN locais_estoque l ON e.local_id = l.id
        WHERE e.variacao_id = ?
      `).all(variacao.id);
    }

    res.json({ ...produto, variacoes });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { sku, nome, custo, preco, variacoes } = req.body;
    if (!sku || !nome) return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });

    const transaction = db.transaction(() => {
      const stmt = db.prepare('INSERT INTO produtos (sku, nome, custo, preco) VALUES (?, ?, ?, ?)');
      const info = stmt.run(sku, nome, custo || 0, preco || 0);
      const produtoId = info.lastInsertRowid;

      if (variacoes && Array.isArray(variacoes)) {
        const insertVar = db.prepare('INSERT INTO produto_variacoes (produto_id, tamanho, cor, sku_variacao) VALUES (?, ?, ?, ?)');
        for (const v of variacoes) {
          insertVar.run(produtoId, v.tamanho, v.cor, v.sku_variacao || null);
        }
      }
      return produtoId;
    });

    const id = transaction();
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
    const { sku, nome, custo, preco } = req.body;
    if (!sku || !nome) return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });

    const stmt = db.prepare('UPDATE produtos SET sku=?, nome=?, custo=?, preco=? WHERE id=?');
    const info = stmt.run(sku, nome, custo, preco, req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'Produto não encontrado' });
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
    res.json({ mensagem: 'Produto desativado com sucesso' });
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
    res.json({ mensagem: 'Estoque atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};
