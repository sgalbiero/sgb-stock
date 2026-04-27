const db = require('../../database/db');

exports.listar = (req, res, next) => {
  try {
    const fornecedores = db.prepare('SELECT * FROM fornecedores WHERE ativo = 1 ORDER BY nome ASC').all();
    res.json(fornecedores);
  } catch (error) {
    next(error);
  }
};

exports.obter = (req, res, next) => {
  try {
    const fornecedor = db.prepare('SELECT * FROM fornecedores WHERE id = ?').get(req.params.id);
    if (!fornecedor) return res.status(404).json({ error: 'Fornecedor não encontrado' });

    const produtosVinculados = db.prepare(`
      SELECT p.id, p.nome, p.sku 
      FROM produtos p
      JOIN produto_fornecedores pf ON p.id = pf.produto_id
      WHERE pf.fornecedor_id = ?
    `).all(req.params.id);

    res.json({ ...fornecedor, produtosVinculados });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { nome, telefone, endereco, cidade, cep, observacoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const stmt = db.prepare('INSERT INTO fornecedores (nome, telefone, endereco, cidade, cep, observacoes) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(nome, telefone, endereco, cidade, cep, observacoes);
    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Fornecedor criado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizar = (req, res, next) => {
  try {
    const { nome, telefone, endereco, cidade, cep, observacoes } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const stmt = db.prepare('UPDATE fornecedores SET nome=?, telefone=?, endereco=?, cidade=?, cep=?, observacoes=? WHERE id=?');
    const info = stmt.run(nome, telefone, endereco, cidade, cep, observacoes, req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json({ mensagem: 'Fornecedor atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.desativar = (req, res, next) => {
  try {
    const stmt = db.prepare('UPDATE fornecedores SET ativo=0 WHERE id=?');
    const info = stmt.run(req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json({ mensagem: 'Fornecedor desativado com sucesso' });
  } catch (error) {
    next(error);
  }
};
