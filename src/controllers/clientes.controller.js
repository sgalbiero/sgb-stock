const db = require('../../database/db');
const { registrarEvento } = require('../services/audit.service');

function montarHistoricoPaginado(clienteId, page = 1, pageSize = 5) {
  const paginaAtual = Math.max(1, Number.parseInt(page, 10) || 1);
  const tamanhoPagina = Math.min(20, Math.max(1, Number.parseInt(pageSize, 10) || 5));
  const offset = (paginaAtual - 1) * tamanhoPagina;

  const total = db.prepare('SELECT COUNT(*) as total FROM vendas WHERE cliente_id = ?').get(clienteId).total;

  const vendas = db.prepare(`
    SELECT id, total, status, status_pagamento, forma_pagamento, desconto, observacoes, criado_em
    FROM vendas
    WHERE cliente_id = ?
    ORDER BY criado_em DESC
    LIMIT ? OFFSET ?
  `).all(clienteId, tamanhoPagina, offset);

  if (!vendas.length) {
    return {
      pedidos: [],
      paginacao: {
        pagina: paginaAtual,
        totalPaginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
        totalItens: total,
        pageSize: tamanhoPagina,
        temAnterior: false,
        temProxima: false,
      }
    };
  }

  const vendaIds = vendas.map(venda => venda.id);
  const placeholders = vendaIds.map(() => '?').join(', ');
  const itens = db.prepare(`
    SELECT 
      vi.venda_id,
      vi.quantidade,
      vi.preco_unit,
      pv.tamanho,
      pv.cor,
      p.nome as produto_nome
    FROM venda_itens vi
    JOIN produto_variacoes pv ON pv.id = vi.variacao_id
    JOIN produtos p ON p.id = pv.produto_id
    WHERE vi.venda_id IN (${placeholders})
    ORDER BY vi.venda_id DESC, p.nome ASC
  `).all(...vendaIds);

  const itensPorVenda = new Map();
  for (const item of itens) {
    if (!itensPorVenda.has(item.venda_id)) {
      itensPorVenda.set(item.venda_id, []);
    }
    itensPorVenda.get(item.venda_id).push(item);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));

  return {
    pedidos: vendas.map(venda => ({
      ...venda,
      itens: itensPorVenda.get(venda.id) || [],
    })),
    paginacao: {
      pagina: paginaAtual,
      totalPaginas,
      totalItens: total,
      pageSize: tamanhoPagina,
      temAnterior: paginaAtual > 1,
      temProxima: paginaAtual < totalPaginas,
    }
  };
}

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

    res.json(cliente);
  } catch (error) {
    next(error);
  }
};

exports.historico = (req, res, next) => {
  try {
    const cliente = db.prepare('SELECT id, nome FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    const { page, pageSize } = req.query;
    const historico = montarHistoricoPaginado(req.params.id, page, pageSize);

    res.json({
      cliente,
      ...historico,
    });
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

    registrarEvento(req, {
      acao: 'cliente.criado',
      entidade: 'cliente',
      entidadeId: info.lastInsertRowid,
      descricao: `Cliente ${nome} cadastrado`,
      detalhes: { telefone, cidade },
    });

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

    registrarEvento(req, {
      acao: 'cliente.atualizado',
      entidade: 'cliente',
      entidadeId: Number(req.params.id),
      descricao: `Cliente ${nome} atualizado`,
      detalhes: { telefone, cidade },
    });

    res.json({ mensagem: 'Cliente atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};
