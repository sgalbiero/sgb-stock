const db = require('../../database/db');

exports.listar = (req, res, next) => {
  try {
    const vendas = db.prepare(`
      SELECT v.*, c.nome as cliente_nome 
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ORDER BY v.criado_em DESC
    `).all();
    res.json(vendas);
  } catch (error) {
    next(error);
  }
};

exports.obter = (req, res, next) => {
  try {
    const venda = db.prepare(`
      SELECT v.*, c.nome as cliente_nome 
      FROM vendas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.id = ?
    `).get(req.params.id);

    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    const itens = db.prepare(`
      SELECT vi.*, pv.tamanho, pv.cor, p.nome as produto_nome 
      FROM venda_itens vi
      JOIN produto_variacoes pv ON vi.variacao_id = pv.id
      JOIN produtos p ON pv.produto_id = p.id
      WHERE vi.venda_id = ?
    `).all(req.params.id);

    res.json({ ...venda, itens });
  } catch (error) {
    next(error);
  }
};

exports.criar = (req, res, next) => {
  try {
    const { cliente_id, total, desconto, forma_pagamento, observacoes, itens } = req.body;
    
    if (!itens || itens.length === 0) return res.status(400).json({ error: 'A venda deve conter itens' });
    if (!total || !forma_pagamento) return res.status(400).json({ error: 'Total e forma de pagamento são obrigatórios' });

    const localPadrao = db.prepare("SELECT id FROM locais_estoque WHERE nome = 'Loja Principal' LIMIT 1").get();
    if (!localPadrao) return res.status(500).json({ error: 'Local de estoque principal não configurado' });

    const transaction = db.transaction(() => {
      // 1. Validar e baixar estoque
      const updateEstoque = db.prepare('UPDATE estoque SET quantidade = quantidade - ? WHERE variacao_id = ? AND local_id = ? AND quantidade >= ?');
      
      for (const item of itens) {
        // Obter custo atual para salvar o histórico
        const variacao = db.prepare(`
          SELECT p.custo 
          FROM produto_variacoes pv
          JOIN produtos p ON pv.produto_id = p.id
          WHERE pv.id = ?
        `).get(item.variacao_id);
        
        if (!variacao) throw new Error(`Variação ${item.variacao_id} não encontrada`);
        item.custo_unit = variacao.custo;

        const info = updateEstoque.run(item.quantidade, item.variacao_id, localPadrao.id, item.quantidade);
        if (info.changes === 0) {
          throw new Error(`Estoque insuficiente para a variação ${item.variacao_id} no local principal`);
        }
      }

      // 2. Registrar a venda
      const insertVenda = db.prepare('INSERT INTO vendas (cliente_id, total, desconto, forma_pagamento, observacoes) VALUES (?, ?, ?, ?, ?)');
      const infoVenda = insertVenda.run(cliente_id || null, total, desconto || 0, forma_pagamento, observacoes);
      const vendaId = infoVenda.lastInsertRowid;

      // 3. Registrar itens da venda
      const insertItem = db.prepare('INSERT INTO venda_itens (venda_id, variacao_id, quantidade, preco_unit, custo_unit) VALUES (?, ?, ?, ?, ?)');
      for (const item of itens) {
        insertItem.run(vendaId, item.variacao_id, item.quantidade, item.preco_unit, item.custo_unit);
      }

      // 4. Lançamento financeiro automático
      const categoriaVenda = db.prepare("SELECT id FROM categorias_financeiras WHERE nome = 'Venda' AND tipo = 'receita' LIMIT 1").get();
      
      db.prepare(`
        INSERT INTO lancamentos_financeiros (tipo, descricao, valor, categoria_id, venda_id, status, pago_em) 
        VALUES ('receita', ?, ?, ?, ?, 'pago', datetime('now', 'localtime'))
      `).run(`Venda #${vendaId}`, total, categoriaVenda ? categoriaVenda.id : null, vendaId);

      return vendaId;
    });

    try {
      const id = transaction();
      res.status(201).json({ id, mensagem: 'Venda realizada com sucesso' });
    } catch (txError) {
      res.status(400).json({ error: txError.message });
    }

  } catch (error) {
    next(error);
  }
};

exports.cancelar = (req, res, next) => {
  try {
    const vendaId = req.params.id;

    const venda = db.prepare('SELECT status FROM vendas WHERE id = ?').get(vendaId);
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
    if (venda.status === 'cancelada') return res.status(400).json({ error: 'Venda já está cancelada' });

    const localPadrao = db.prepare("SELECT id FROM locais_estoque WHERE nome = 'Loja Principal' LIMIT 1").get();

    const transaction = db.transaction(() => {
      // 1. Atualizar status da venda
      db.prepare("UPDATE vendas SET status = 'cancelada' WHERE id = ?").run(vendaId);

      // 2. Repor estoque
      const itens = db.prepare('SELECT variacao_id, quantidade FROM venda_itens WHERE venda_id = ?').all(vendaId);
      const updateEstoque = db.prepare('UPDATE estoque SET quantidade = quantidade + ? WHERE variacao_id = ? AND local_id = ?');
      for (const item of itens) {
        updateEstoque.run(item.quantidade, item.variacao_id, localPadrao.id);
      }

      // 3. Cancelar lançamento financeiro (deletar ou marcar cancelado)
      // O PRD diz "cancela lançamento". Vamos alterar status ou descricao, ou deletar. 
      // Vamos mudar o status para 'cancelado' (não previso no enum original, ou deletar. O PRD diz: cancela lançamento financeiro vinculado). 
      // Vamos mudar status para 'cancelado' ou excluir. Excluir mantém mais limpo o saldo, mas vamos manter o registro alterando o valor e status para rastreio. 
      // O PRD diz: "cancela lançamento". Vamos deletar para simplificar o MVP.
      db.prepare("DELETE FROM lancamentos_financeiros WHERE venda_id = ?").run(vendaId);
    });

    transaction();
    res.json({ mensagem: 'Venda cancelada com sucesso. Estoque reposto.' });

  } catch (error) {
    next(error);
  }
};
