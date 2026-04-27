const db = require('../../database/db');
const { registrarEvento } = require('../services/audit.service');

exports.listar = (req, res, next) => {
  try {
    const locais = db.prepare(`
      SELECT l.*, COALESCE(COUNT(e.id), 0) as registros_estoque
      FROM locais_estoque l
      LEFT JOIN estoque e ON e.local_id = l.id
      GROUP BY l.id
      ORDER BY l.nome COLLATE NOCASE ASC
    `).all();
    res.json(locais);
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome do local é obrigatório' });

    const existente = db.prepare('SELECT id FROM locais_estoque WHERE lower(nome) = lower(?)').get(nome);
    if (existente) return res.status(400).json({ error: 'Já existe um local com esse nome' });

    const info = db.prepare('INSERT INTO locais_estoque (nome) VALUES (?)').run(nome);

    registrarEvento(req, {
      acao: 'local.criado',
      entidade: 'local_estoque',
      entidadeId: info.lastInsertRowid,
      descricao: `Local de estoque ${nome} criado`,
    });

    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Local criado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizar = (req, res, next) => {
  try {
    const localId = Number(req.params.id);
    const nome = String(req.body.nome || '').trim();
    if (!localId || !nome) return res.status(400).json({ error: 'Nome do local é obrigatório' });

    const local = db.prepare('SELECT id, nome FROM locais_estoque WHERE id = ?').get(localId);
    if (!local) return res.status(404).json({ error: 'Local não encontrado' });
    if (local.nome === 'Loja Principal' && nome !== 'Loja Principal') {
      return res.status(400).json({ error: 'O local padrão Loja Principal não pode ser renomeado' });
    }

    const duplicado = db.prepare('SELECT id FROM locais_estoque WHERE lower(nome) = lower(?) AND id != ?').get(nome, localId);
    if (duplicado) return res.status(400).json({ error: 'Já existe um local com esse nome' });

    db.prepare('UPDATE locais_estoque SET nome = ? WHERE id = ?').run(nome, localId);

    registrarEvento(req, {
      acao: 'local.atualizado',
      entidade: 'local_estoque',
      entidadeId: localId,
      descricao: `Local de estoque ${local.nome} atualizado`,
      detalhes: { nome_anterior: local.nome, novo_nome: nome },
    });

    res.json({ mensagem: 'Local atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.excluir = (req, res, next) => {
  try {
    const localId = Number(req.params.id);
    if (!localId) return res.status(400).json({ error: 'Local inválido' });

    const local = db.prepare('SELECT id, nome FROM locais_estoque WHERE id = ?').get(localId);
    if (!local) return res.status(404).json({ error: 'Local não encontrado' });
    if (local.nome === 'Loja Principal') {
      return res.status(400).json({ error: 'O local padrão Loja Principal não pode ser excluído' });
    }

    const uso = db.prepare('SELECT COUNT(*) as total FROM estoque WHERE local_id = ?').get(localId).total;
    if (uso > 0) {
      return res.status(400).json({ error: 'Este local possui estoque registrado e não pode ser excluído' });
    }

    db.prepare('DELETE FROM locais_estoque WHERE id = ?').run(localId);

    registrarEvento(req, {
      acao: 'local.excluido',
      entidade: 'local_estoque',
      entidadeId: localId,
      descricao: `Local de estoque ${local.nome} excluído`,
    });

    res.json({ mensagem: 'Local excluído com sucesso' });
  } catch (error) {
    next(error);
  }
};