const db = require('../../database/db');

exports.listar = (req, res, next) => {
  try {
    const { tipo, status, inicio, fim } = req.query;
    let query = `
      SELECT lf.*, cf.nome as categoria_nome 
      FROM lancamentos_financeiros lf
      LEFT JOIN categorias_financeiras cf ON lf.categoria_id = cf.id
      WHERE 1=1
    `;
    const params = [];

    if (tipo) { query += ' AND lf.tipo = ?'; params.push(tipo); }
    if (status) { query += ' AND lf.status = ?'; params.push(status); }
    if (inicio) { query += ' AND lf.criado_em >= ?'; params.push(inicio); }
    if (fim) { query += ' AND lf.criado_em <= ?'; params.push(fim + ' 23:59:59'); }

    query += ' ORDER BY lf.criado_em DESC';

    const lancamentos = db.prepare(query).all(...params);
    res.json(lancamentos);
  } catch (error) {
    next(error);
  }
};

exports.saldo = (req, res, next) => {
  try {
    const receitas = db.prepare("SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros WHERE tipo = 'receita' AND status = 'pago'").get();
    const despesas = db.prepare("SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros WHERE tipo = 'despesa' AND status = 'pago'").get();
    const saldo = receitas.total - despesas.total;
    res.json({ receitas: receitas.total, despesas: despesas.total, saldo });
  } catch (error) {
    next(error);
  }
};

exports.fluxo = (req, res, next) => {
  try {
    const { inicio, fim } = req.query;
    let query = "WHERE status = 'pago'";
    const params = [];

    if (inicio) { query += ' AND pago_em >= ?'; params.push(inicio); }
    if (fim) { query += ' AND pago_em <= ?'; params.push(fim + ' 23:59:59'); }

    const receitas = db.prepare(`SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros ${query} AND tipo = 'receita'`).get(...params);
    const despesas = db.prepare(`SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros ${query} AND tipo = 'despesa'`).get(...params);

    res.json({
      receitas: receitas.total,
      despesas: despesas.total,
      saldo: receitas.total - despesas.total,
      periodo: { inicio, fim }
    });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { tipo, descricao, valor, categoria_id, vencimento, observacoes } = req.body;
    if (!tipo || !descricao || !valor) return res.status(400).json({ error: 'Tipo, descrição e valor são obrigatórios' });

    const stmt = db.prepare('INSERT INTO lancamentos_financeiros (tipo, descricao, valor, categoria_id, vencimento, observacoes) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(tipo, descricao, valor, categoria_id || null, vencimento || null, observacoes || null);
    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Lançamento criado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizar = (req, res, next) => {
  try {
    const { tipo, descricao, valor, categoria_id, vencimento, observacoes } = req.body;
    const stmt = db.prepare('UPDATE lancamentos_financeiros SET tipo=?, descricao=?, valor=?, categoria_id=?, vencimento=?, observacoes=? WHERE id=?');
    const info = stmt.run(tipo, descricao, valor, categoria_id || null, vencimento || null, observacoes || null, req.params.id);

    if (info.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ mensagem: 'Lançamento atualizado' });
  } catch (error) {
    next(error);
  }
};

exports.pagar = (req, res, next) => {
  try {
    const stmt = db.prepare("UPDATE lancamentos_financeiros SET status='pago', pago_em=datetime('now','localtime') WHERE id=?");
    const info = stmt.run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ mensagem: 'Lançamento marcado como pago' });
  } catch (error) {
    next(error);
  }
};

exports.excluir = (req, res, next) => {
  try {
    // Não permitir excluir lançamentos gerados por venda
    const lancamento = db.prepare('SELECT venda_id FROM lancamentos_financeiros WHERE id=?').get(req.params.id);
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });
    if (lancamento.venda_id) return res.status(400).json({ error: 'Lançamentos gerados por vendas não podem ser excluídos manualmente. Cancele a venda.' });

    db.prepare('DELETE FROM lancamentos_financeiros WHERE id=?').run(req.params.id);
    res.json({ mensagem: 'Lançamento excluído' });
  } catch (error) {
    next(error);
  }
};

exports.categorias = (req, res, next) => {
  try {
    const cats = db.prepare('SELECT * FROM categorias_financeiras ORDER BY tipo, nome').all();
    res.json(cats);
  } catch (error) {
    next(error);
  }
};
