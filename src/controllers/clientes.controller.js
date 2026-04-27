const db = require('../../database/db');

exports.listar = (req, res, next) => {
  try {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome ASC').all();
    res.json(clientes);
  } catch (error) {
    next(error);
  }
};

exports.obter = (req, res, next) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    // Histórico de compras
    const historico = db.prepare(`
      SELECT id, total, data, status 
      FROM vendas 
      WHERE cliente_id = ? 
      ORDER BY criado_em DESC
    `).all(req.params.id);

    res.json({ ...cliente, historico });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { nome, telefone, endereco, bairro, cidade, cep } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const stmt = db.prepare('INSERT INTO clientes (nome, telefone, endereco, bairro, cidade, cep) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(nome, telefone, endereco, bairro, cidade, cep);
    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Cliente criado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizar = (req, res, next) => {
  try {
    const { nome, telefone, endereco, bairro, cidade, cep } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const stmt = db.prepare('UPDATE clientes SET nome=?, telefone=?, endereco=?, bairro=?, cidade=?, cep=? WHERE id=?');
    const info = stmt.run(nome, telefone, endereco, bairro, cidade, cep, req.params.id);
    
    if (info.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ mensagem: 'Cliente atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};
