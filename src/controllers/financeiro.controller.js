const db = require('../../database/db');
const { registrarEvento } = require('../services/audit.service');

function adicionarFiltroPeriodo(queryBase, params, inicio, fim, campoData = 'pago_em') {
  let query = queryBase;

  if (inicio) {
    query += ` AND ${campoData} >= ?`;
    params.push(inicio);
  }

  if (fim) {
    query += ` AND ${campoData} <= ?`;
    params.push(fim + ' 23:59:59');
  }

  return query;
}

function obterResumoFinanceiro(inicio, fim) {
  const paramsReceitas = [];
  const paramsDespesas = [];

  const queryReceitas = adicionarFiltroPeriodo(
    "SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros WHERE tipo = 'receita' AND status = 'pago'",
    paramsReceitas,
    inicio,
    fim
  );

  const queryDespesas = adicionarFiltroPeriodo(
    "SELECT COALESCE(SUM(valor), 0) as total FROM lancamentos_financeiros WHERE tipo = 'despesa' AND status = 'pago'",
    paramsDespesas,
    inicio,
    fim
  );

  const receitas = db.prepare(queryReceitas).get(...paramsReceitas).total;
  const despesas = db.prepare(queryDespesas).get(...paramsDespesas).total;

  return { receitas, despesas, saldo: receitas - despesas };
}

function obterResumoVendas(inicio, fim) {
  const params = [];
  const filtroPeriodo = adicionarFiltroPeriodo(
    `
      WHERE lf.tipo = 'receita'
        AND lf.status = 'pago'
        AND v.status != 'cancelada'
    `,
    params,
    inicio,
    fim,
    'lf.pago_em'
  );

  const vendas = db.prepare(`
    SELECT v.id, v.total
    FROM vendas v
    JOIN lancamentos_financeiros lf ON lf.venda_id = v.id
    ${filtroPeriodo}
    GROUP BY v.id
  `).all(...params);

  const vendaIds = vendas.map(venda => venda.id);
  const receitaLiquida = vendas.reduce((total, venda) => total + venda.total, 0);
  const totalVendas = vendas.length;

  let custoProdutos = 0;
  if (vendaIds.length) {
    const placeholders = vendaIds.map(() => '?').join(', ');
    const custos = db.prepare(`
      SELECT COALESCE(SUM(quantidade * custo_unit), 0) as total
      FROM venda_itens
      WHERE venda_id IN (${placeholders})
    `).get(...vendaIds);
    custoProdutos = custos.total;
  }

  return { receitaLiquida, totalVendas, custoProdutos };
}

function listarDiasNoPeriodo(inicio, fim) {
  const dias = [];
  const dataAtual = new Date(`${inicio}T00:00:00`);
  const dataFinal = new Date(`${fim}T00:00:00`);

  while (dataAtual <= dataFinal) {
    dias.push(dataAtual.toISOString().slice(0, 10));
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  return dias;
}

function obterInicioSemana(dataTexto) {
  const data = new Date(`${dataTexto}T00:00:00`);
  const diaSemana = data.getDay();
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + deslocamento);
  return data.toISOString().slice(0, 10);
}

function obterChaveAgrupamento(dataTexto, agrupamento) {
  if (agrupamento === 'mensal') return dataTexto.slice(0, 7);
  if (agrupamento === 'semanal') return obterInicioSemana(dataTexto);
  return dataTexto;
}

function formatarRotuloAgrupamento(chave, agrupamento) {
  if (agrupamento === 'mensal') {
    const [ano, mes] = chave.split('-');
    return `${mes}/${ano}`;
  }

  if (agrupamento === 'semanal') {
    return `Sem. ${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
  }

  return chave;
}

function agruparSerie(pontosDiarios, agrupamento) {
  if (agrupamento === 'diario') {
    return pontosDiarios.map(ponto => ({ ...ponto, label: formatarRotuloAgrupamento(ponto.data, agrupamento) }));
  }

  const mapa = new Map();

  for (const ponto of pontosDiarios) {
    const chave = obterChaveAgrupamento(ponto.data, agrupamento);
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        data: chave,
        label: formatarRotuloAgrupamento(chave, agrupamento),
        receitas: 0,
        despesas: 0,
        lucro: 0,
      });
    }

    const grupo = mapa.get(chave);
    grupo.receitas += ponto.receitas;
    grupo.despesas += ponto.despesas;
    grupo.lucro += ponto.lucro;
  }

  return Array.from(mapa.values()).sort((a, b) => a.data.localeCompare(b.data));
}

function normalizarDiaVencimento(valor) {
  const dia = Number.parseInt(valor, 10);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null;
  return dia;
}

function normalizarPeriodicidade(valor) {
  return ['semanal', 'mensal', 'anual'].includes(valor) ? valor : 'mensal';
}

function normalizarIntervalo(valor) {
  const intervalo = Number.parseInt(valor, 10);
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 12) return 1;
  return intervalo;
}

function parseDataLocal(texto) {
  if (!texto) return null;
  const [ano, mes, dia] = String(texto).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

function formatarDataLocal(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function adicionarDias(data, quantidade) {
  const copia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  copia.setDate(copia.getDate() + quantidade);
  return copia;
}

function adicionarMesesMantendoDia(data, quantidade) {
  const ano = data.getFullYear();
  const mesBase = data.getMonth();
  const dia = data.getDate();
  const alvo = new Date(ano, mesBase + quantidade, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimoDia));
}

function adicionarAnosMantendoDia(data, quantidade) {
  return adicionarMesesMantendoDia(data, quantidade * 12);
}

function obterCompetenciaBase(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function somarMeses(competencia, quantidade) {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(ano, mes - 1 + quantidade, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function montarDataVencimento(competencia, diaVencimento) {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaVencimento, ultimoDia);
  return `${competencia}-${String(dia).padStart(2, '0')}`;
}

function listarCompetenciasPadrao() {
  const atual = obterCompetenciaBase();
  return [atual, somarMeses(atual, 1)];
}

function obterChaveRecorrencia(data, periodicidade) {
  const dataTexto = formatarDataLocal(data);
  if (periodicidade === 'mensal') return dataTexto.slice(0, 7);
  if (periodicidade === 'anual') return dataTexto.slice(0, 4);
  return dataTexto;
}

function avancarRecorrencia(data, periodicidade, intervalo) {
  if (periodicidade === 'semanal') return adicionarDias(data, intervalo * 7);
  if (periodicidade === 'anual') return adicionarAnosMantendoDia(data, intervalo);
  return adicionarMesesMantendoDia(data, intervalo);
}

function gerarOcorrenciasDespesa(despesa, diasPassado = 45, diasFuturo = 120) {
  const periodicidade = normalizarPeriodicidade(despesa.periodicidade);
  const intervalo = normalizarIntervalo(despesa.intervalo_repeticao);
  const fallbackDia = normalizarDiaVencimento(despesa.dia_vencimento) || 1;
  const base = parseDataLocal(despesa.data_base) || parseDataLocal(`${formatarDataLocal(new Date()).slice(0, 8)}${String(Math.min(fallbackDia, 28)).padStart(2, '0')}`);
  const inicioJanela = adicionarDias(new Date(), -diasPassado);
  const fimJanela = adicionarDias(new Date(), diasFuturo);
  const ocorrencias = [];
  let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  let guard = 0;

  while (cursor < inicioJanela && guard < 500) {
    cursor = avancarRecorrencia(cursor, periodicidade, intervalo);
    guard += 1;
  }

  while (cursor <= fimJanela && guard < 700) {
    ocorrencias.push({
      data: formatarDataLocal(cursor),
      referencia: obterChaveRecorrencia(cursor, periodicidade),
    });
    cursor = avancarRecorrencia(cursor, periodicidade, intervalo);
    guard += 1;
  }

  return ocorrencias;
}

function garantirLancamentosDespesasFixas(competencias = listarCompetenciasPadrao()) {
  const despesasFixas = db.prepare(`
    SELECT id, descricao, valor, categoria_id, dia_vencimento, observacoes, periodicidade, intervalo_repeticao, data_base
    FROM despesas_fixas
    WHERE ativa = 1
    ORDER BY descricao COLLATE NOCASE ASC
  `).all();

  const existeStmt = db.prepare(`
    SELECT id FROM lancamentos_financeiros
    WHERE despesa_fixa_id = ?
      AND (
        referencia_mes = ?
        OR date(vencimento) = date(?)
      )
    LIMIT 1
  `);
  const insertStmt = db.prepare(`
    INSERT INTO lancamentos_financeiros (
      tipo,
      descricao,
      valor,
      categoria_id,
      vencimento,
      observacoes,
      despesa_fixa_id,
      referencia_mes,
      status
    ) VALUES ('despesa', ?, ?, ?, ?, ?, ?, ?, 'pendente')
  `);

  const transaction = db.transaction(() => {
    for (const despesa of despesasFixas) {
      const ocorrencias = gerarOcorrenciasDespesa(despesa);
      for (const ocorrencia of ocorrencias) {
        const existente = existeStmt.get(despesa.id, ocorrencia.referencia, ocorrencia.data);
        if (existente) continue;

        insertStmt.run(
          despesa.descricao,
          despesa.valor,
          despesa.categoria_id || null,
          ocorrencia.data,
          despesa.observacoes || null,
          despesa.id,
          ocorrencia.referencia
        );
      }
    }
  });

  transaction();
}

function obterAlertasVencimento(dias = 7) {
  garantirLancamentosDespesasFixas();
  const limite = Math.max(1, Number.parseInt(dias, 10) || 7);
  return db.prepare(`
    SELECT
      lf.id,
      lf.descricao,
      lf.valor,
      lf.vencimento,
      lf.status,
      lf.despesa_fixa_id,
      df.dia_vencimento,
      cf.nome as categoria_nome,
      CASE
        WHEN date(lf.vencimento) < date('now', 'localtime') THEN 'atrasado'
        WHEN date(lf.vencimento) = date('now', 'localtime') THEN 'vence_hoje'
        ELSE 'proximo'
      END as urgencia,
      CAST(julianday(date(lf.vencimento)) - julianday(date('now', 'localtime')) AS INTEGER) as dias_restantes
    FROM lancamentos_financeiros lf
    LEFT JOIN despesas_fixas df ON df.id = lf.despesa_fixa_id
    LEFT JOIN categorias_financeiras cf ON cf.id = lf.categoria_id
    WHERE lf.tipo = 'despesa'
      AND lf.status = 'pendente'
      AND lf.vencimento IS NOT NULL
      AND date(lf.vencimento) <= date('now', 'localtime', '+' || ? || ' days')
    ORDER BY date(lf.vencimento) ASC, lf.valor DESC
  `).all(limite);
}

function obterResumoAlertasAtraso(itens) {
  return {
    atrasadas_1_7: itens.filter(item => item.urgencia === 'atrasado' && Math.abs(item.dias_restantes) <= 7).length,
    atrasadas_8_30: itens.filter(item => item.urgencia === 'atrasado' && Math.abs(item.dias_restantes) >= 8 && Math.abs(item.dias_restantes) <= 30).length,
    atrasadas_mais_30: itens.filter(item => item.urgencia === 'atrasado' && Math.abs(item.dias_restantes) > 30).length,
    vencem_1_3: itens.filter(item => item.urgencia !== 'atrasado' && item.dias_restantes >= 0 && item.dias_restantes <= 3).length,
    vencem_4_7: itens.filter(item => item.urgencia !== 'atrasado' && item.dias_restantes >= 4 && item.dias_restantes <= 7).length,
  };
}

function listarDespesasFixasComResumo() {
  garantirLancamentosDespesasFixas();
  return db.prepare(`
    SELECT
      df.*,
      cf.nome as categoria_nome,
      (
        SELECT atual.id
        FROM lancamentos_financeiros atual
        WHERE atual.despesa_fixa_id = df.id
        ORDER BY CASE WHEN atual.status = 'pendente' THEN 0 ELSE 1 END, date(atual.vencimento) ASC
        LIMIT 1
      ) as lancamento_atual_id,
      (
        SELECT atual.vencimento
        FROM lancamentos_financeiros atual
        WHERE atual.despesa_fixa_id = df.id
        ORDER BY CASE WHEN atual.status = 'pendente' THEN 0 ELSE 1 END, date(atual.vencimento) ASC
        LIMIT 1
      ) as proximo_vencimento,
      (
        SELECT atual.status
        FROM lancamentos_financeiros atual
        WHERE atual.despesa_fixa_id = df.id
        ORDER BY CASE WHEN atual.status = 'pendente' THEN 0 ELSE 1 END, date(atual.vencimento) ASC
        LIMIT 1
      ) as status_atual
    FROM despesas_fixas df
    LEFT JOIN categorias_financeiras cf ON cf.id = df.categoria_id
    ORDER BY df.ativa DESC, df.descricao COLLATE NOCASE ASC
  `).all();
}

exports.listar = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { tipo, status, inicio, fim } = req.query;
    let query = `
      SELECT lf.*, cf.nome as categoria_nome, df.dia_vencimento as despesa_fixa_dia, df.ativa as despesa_fixa_ativa
      FROM lancamentos_financeiros lf
      LEFT JOIN categorias_financeiras cf ON lf.categoria_id = cf.id
      LEFT JOIN despesas_fixas df ON df.id = lf.despesa_fixa_id
      WHERE 1=1
    `;
    const params = [];

    if (tipo) { query += ' AND lf.tipo = ?'; params.push(tipo); }
    if (status) { query += ' AND lf.status = ?'; params.push(status); }
    if (inicio) { query += ' AND lf.criado_em >= ?'; params.push(inicio); }
    if (fim) { query += ' AND lf.criado_em <= ?'; params.push(fim + ' 23:59:59'); }

    query += `
      ORDER BY
        CASE WHEN lf.status = 'pendente' AND lf.vencimento IS NOT NULL THEN 0 ELSE 1 END,
        date(COALESCE(lf.vencimento, lf.criado_em)) ASC,
        lf.criado_em DESC
    `;

    const lancamentos = db.prepare(query).all(...params);
    res.json(lancamentos);
  } catch (error) {
    next(error);
  }
};

exports.saldo = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { inicio, fim } = req.query;
    const resumo = obterResumoFinanceiro(inicio, fim);
    res.json({ ...resumo, periodo: { inicio: inicio || null, fim: fim || null } });
  } catch (error) {
    next(error);
  }
};

exports.fluxo = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { inicio, fim } = req.query;
    const { receitas, despesas, saldo } = obterResumoFinanceiro(inicio, fim);

    res.json({
      receitas,
      despesas,
      saldo,
      periodo: { inicio, fim }
    });
  } catch (error) {
    next(error);
  }
};

exports.indicadores = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { inicio, fim } = req.query;
    const resumoFinanceiro = obterResumoFinanceiro(inicio, fim);
    const resumoVendas = obterResumoVendas(inicio, fim);

    const lucroBruto = resumoVendas.receitaLiquida - resumoVendas.custoProdutos;
    const lucroLiquido = lucroBruto - resumoFinanceiro.despesas;
    const margemBruta = resumoVendas.receitaLiquida > 0 ? (lucroBruto / resumoVendas.receitaLiquida) * 100 : 0;
    const margemLiquida = resumoVendas.receitaLiquida > 0 ? (lucroLiquido / resumoVendas.receitaLiquida) * 100 : 0;
    const ticketMedio = resumoVendas.totalVendas > 0 ? resumoVendas.receitaLiquida / resumoVendas.totalVendas : 0;

    res.json({
      periodo: { inicio: inicio || null, fim: fim || null },
      receita_liquida: resumoVendas.receitaLiquida,
      custo_produtos: resumoVendas.custoProdutos,
      despesas: resumoFinanceiro.despesas,
      lucro_bruto: lucroBruto,
      lucro_liquido: lucroLiquido,
      margem_bruta: margemBruta,
      margem_liquida: margemLiquida,
      ticket_medio: ticketMedio,
      total_vendas: resumoVendas.totalVendas
    });
  } catch (error) {
    next(error);
  }
};

exports.desempenhoProdutos = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { inicio, fim, limite } = req.query;
    const params = [];
    const filtroPeriodo = adicionarFiltroPeriodo(
      `
        WHERE lf.tipo = 'receita'
          AND lf.status = 'pago'
          AND v.status != 'cancelada'
      `,
      params,
      inicio,
      fim,
      'lf.pago_em'
    );
    const limit = Number(limite) > 0 ? Number(limite) : 5;

    const produtos = db.prepare(`
      SELECT
        p.id as produto_id,
        p.nome as produto_nome,
        SUM(vi.quantidade) as quantidade_vendida,
        SUM(vi.preco_unit * vi.quantidade) as receita,
        SUM(vi.custo_unit * vi.quantidade) as custo,
        SUM((vi.preco_unit - vi.custo_unit) * vi.quantidade) as lucro_bruto,
        CASE
          WHEN SUM(vi.preco_unit * vi.quantidade) > 0
          THEN (SUM((vi.preco_unit - vi.custo_unit) * vi.quantidade) / SUM(vi.preco_unit * vi.quantidade)) * 100
          ELSE 0
        END as margem_bruta
      FROM venda_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      JOIN produto_variacoes pv ON pv.id = vi.variacao_id
      JOIN produtos p ON p.id = pv.produto_id
      JOIN lancamentos_financeiros lf ON lf.venda_id = v.id
      ${filtroPeriodo}
      GROUP BY p.id, p.nome
      ORDER BY receita DESC, lucro_bruto DESC
      LIMIT ?
    `).all(...params, limit);

    res.json({
      periodo: { inicio: inicio || null, fim: fim || null },
      produtos
    });
  } catch (error) {
    next(error);
  }
};

exports.seriePeriodo = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const { inicio, fim } = req.query;
    const agrupamento = ['diario', 'semanal', 'mensal'].includes(req.query.agrupamento) ? req.query.agrupamento : 'diario';
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'Informe início e fim para gerar o gráfico' });
    }

    const dias = listarDiasNoPeriodo(inicio, fim);
    const mapa = new Map(dias.map(dia => [dia, { data: dia, receitas: 0, despesas: 0, lucro: 0 }]));

    const lancamentos = db.prepare(`
      SELECT substr(pago_em, 1, 10) as data, tipo, COALESCE(SUM(valor), 0) as total
      FROM lancamentos_financeiros
      WHERE status = 'pago'
        AND pago_em >= ?
        AND pago_em <= ?
      GROUP BY substr(pago_em, 1, 10), tipo
      ORDER BY substr(pago_em, 1, 10)
    `).all(inicio, fim + ' 23:59:59');

    for (const lancamento of lancamentos) {
      const dia = mapa.get(lancamento.data);
      if (!dia) continue;
      if (lancamento.tipo === 'receita') dia.receitas = lancamento.total;
      if (lancamento.tipo === 'despesa') dia.despesas = lancamento.total;
    }

    const vendas = db.prepare(`
      SELECT
        substr(lf.pago_em, 1, 10) as data,
        v.id,
        COALESCE(SUM((vi.preco_unit - vi.custo_unit) * vi.quantidade), 0) as lucro
      FROM vendas v
      JOIN lancamentos_financeiros lf ON lf.venda_id = v.id
      LEFT JOIN venda_itens vi ON vi.venda_id = v.id
      WHERE lf.tipo = 'receita'
        AND lf.status = 'pago'
        AND v.status != 'cancelada'
        AND lf.pago_em >= ?
        AND lf.pago_em <= ?
      GROUP BY substr(lf.pago_em, 1, 10), v.id
      ORDER BY substr(lf.pago_em, 1, 10), v.id
    `).all(inicio, fim + ' 23:59:59');

    for (const venda of vendas) {
      const dia = mapa.get(venda.data);
      if (!dia) continue;
      dia.lucro += venda.lucro;
    }

    const pontosDiarios = dias.map(dia => mapa.get(dia));

    res.json({
      periodo: { inicio, fim },
      agrupamento,
      pontos: agruparSerie(pontosDiarios, agrupamento)
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

    registrarEvento(req, {
      acao: 'financeiro.lancamento_criado',
      entidade: 'lancamento_financeiro',
      entidadeId: info.lastInsertRowid,
      descricao: `Lançamento financeiro ${descricao} criado`,
      detalhes: { tipo, valor, categoria_id: categoria_id || null },
    });

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

    registrarEvento(req, {
      acao: 'financeiro.lancamento_atualizado',
      entidade: 'lancamento_financeiro',
      entidadeId: Number(req.params.id),
      descricao: `Lançamento financeiro ${descricao} atualizado`,
      detalhes: { tipo, valor, categoria_id: categoria_id || null },
    });

    res.json({ mensagem: 'Lançamento atualizado' });
  } catch (error) {
    next(error);
  }
};

exports.pagar = (req, res, next) => {
  try {
    const lancamento = db.prepare('SELECT venda_id FROM lancamentos_financeiros WHERE id=?').get(req.params.id);
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

    const transaction = db.transaction(() => {
      const stmt = db.prepare("UPDATE lancamentos_financeiros SET status='pago', pago_em=datetime('now','localtime') WHERE id=?");
      const info = stmt.run(req.params.id);

      if (info.changes > 0 && lancamento.venda_id) {
        db.prepare("UPDATE vendas SET status_pagamento='pago' WHERE id=?").run(lancamento.venda_id);
      }

      return info;
    });

    const info = transaction();
    if (info.changes === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });

    registrarEvento(req, {
      acao: 'financeiro.lancamento_pago',
      entidade: 'lancamento_financeiro',
      entidadeId: Number(req.params.id),
      descricao: `Lançamento financeiro #${req.params.id} marcado como pago`,
    });

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

    registrarEvento(req, {
      acao: 'financeiro.lancamento_excluido',
      entidade: 'lancamento_financeiro',
      entidadeId: Number(req.params.id),
      descricao: `Lançamento financeiro #${req.params.id} excluído`,
    });

    res.json({ mensagem: 'Lançamento excluído' });
  } catch (error) {
    next(error);
  }
};

exports.categorias = (req, res, next) => {
  try {
    garantirLancamentosDespesasFixas();
    const cats = db.prepare('SELECT * FROM categorias_financeiras ORDER BY tipo, nome').all();
    res.json(cats);
  } catch (error) {
    next(error);
  }
};

exports.criarCategoria = (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const tipo = req.body.tipo;

    if (!nome || !['receita', 'despesa'].includes(tipo)) {
      return res.status(400).json({ error: 'Nome e tipo válido são obrigatórios' });
    }

    const existente = db.prepare('SELECT id FROM categorias_financeiras WHERE nome = ? AND tipo = ?').get(nome, tipo);
    if (existente) return res.status(400).json({ error: 'Já existe uma categoria com esse nome e tipo' });

    const info = db.prepare('INSERT INTO categorias_financeiras (nome, tipo) VALUES (?, ?)').run(nome, tipo);

    registrarEvento(req, {
      acao: 'financeiro.categoria_criada',
      entidade: 'categoria_financeira',
      entidadeId: info.lastInsertRowid,
      descricao: `Categoria financeira ${nome} criada`,
      detalhes: { tipo },
    });

    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Categoria criada com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizarCategoria = (req, res, next) => {
  try {
    const categoriaId = Number(req.params.id);
    const nome = String(req.body.nome || '').trim();
    const tipo = req.body.tipo;

    if (!categoriaId || !nome || !['receita', 'despesa'].includes(tipo)) {
      return res.status(400).json({ error: 'Nome e tipo válido são obrigatórios' });
    }

    const duplicada = db.prepare('SELECT id FROM categorias_financeiras WHERE nome = ? AND tipo = ? AND id != ?').get(nome, tipo, categoriaId);
    if (duplicada) return res.status(400).json({ error: 'Já existe uma categoria com esse nome e tipo' });

    const info = db.prepare('UPDATE categorias_financeiras SET nome = ?, tipo = ? WHERE id = ?').run(nome, tipo, categoriaId);
    if (info.changes === 0) return res.status(404).json({ error: 'Categoria não encontrada' });

    registrarEvento(req, {
      acao: 'financeiro.categoria_atualizada',
      entidade: 'categoria_financeira',
      entidadeId: categoriaId,
      descricao: `Categoria financeira ${nome} atualizada`,
      detalhes: { tipo },
    });

    res.json({ mensagem: 'Categoria atualizada com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.excluirCategoria = (req, res, next) => {
  try {
    const categoriaId = Number(req.params.id);
    if (!categoriaId) return res.status(400).json({ error: 'Categoria inválida' });

    const uso = db.prepare('SELECT COUNT(*) as total FROM lancamentos_financeiros WHERE categoria_id = ?').get(categoriaId).total;
    if (uso > 0) {
      return res.status(400).json({ error: 'Esta categoria já foi usada em lançamentos e não pode ser excluída' });
    }

    const info = db.prepare('DELETE FROM categorias_financeiras WHERE id = ?').run(categoriaId);
    if (info.changes === 0) return res.status(404).json({ error: 'Categoria não encontrada' });

    registrarEvento(req, {
      acao: 'financeiro.categoria_excluida',
      entidade: 'categoria_financeira',
      entidadeId: categoriaId,
      descricao: `Categoria financeira #${categoriaId} excluída`,
    });

    res.json({ mensagem: 'Categoria excluída com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.listarDespesasFixas = (req, res, next) => {
  try {
    res.json(listarDespesasFixasComResumo());
  } catch (error) {
    next(error);
  }
};

exports.criarDespesaFixa = (req, res, next) => {
  try {
    const descricao = String(req.body.descricao || '').trim();
    const valor = Number(req.body.valor);
    const categoriaId = req.body.categoria_id || null;
    const periodicidade = normalizarPeriodicidade(req.body.periodicidade);
    const intervaloRepeticao = normalizarIntervalo(req.body.intervalo_repeticao);
    const dataBase = String(req.body.data_base || '').trim();
    const diaVencimento = normalizarDiaVencimento(req.body.dia_vencimento || dataBase.slice(8, 10));
    const observacoes = String(req.body.observacoes || '').trim();

    if (!descricao || !(valor > 0) || !diaVencimento || !parseDataLocal(dataBase)) {
      return res.status(400).json({ error: 'Descrição, valor, data base e vencimento válidos são obrigatórios' });
    }

    const info = db.prepare(`
      INSERT INTO despesas_fixas (descricao, valor, categoria_id, dia_vencimento, observacoes, ativa, periodicidade, intervalo_repeticao, data_base)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(descricao, valor, categoriaId, diaVencimento, observacoes || null, periodicidade, intervaloRepeticao, dataBase);

    garantirLancamentosDespesasFixas();

    registrarEvento(req, {
      acao: 'financeiro.despesa_fixa_criada',
      entidade: 'despesa_fixa',
      entidadeId: info.lastInsertRowid,
      descricao: `Despesa fixa ${descricao} criada`,
      detalhes: { valor, dia_vencimento: diaVencimento, periodicidade, intervalo_repeticao: intervaloRepeticao, data_base: dataBase },
    });

    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Despesa fixa criada com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizarDespesaFixa = (req, res, next) => {
  try {
    const despesaId = Number(req.params.id);
    const descricao = String(req.body.descricao || '').trim();
    const valor = Number(req.body.valor);
    const categoriaId = req.body.categoria_id || null;
    const periodicidade = normalizarPeriodicidade(req.body.periodicidade);
    const intervaloRepeticao = normalizarIntervalo(req.body.intervalo_repeticao);
    const dataBase = String(req.body.data_base || '').trim();
    const diaVencimento = normalizarDiaVencimento(req.body.dia_vencimento || dataBase.slice(8, 10));
    const observacoes = String(req.body.observacoes || '').trim();
    const ativa = req.body.ativa ? 1 : 0;

    if (!despesaId || !descricao || !(valor > 0) || !diaVencimento || !parseDataLocal(dataBase)) {
      return res.status(400).json({ error: 'Descrição, valor, data base e vencimento válidos são obrigatórios' });
    }

    const info = db.prepare(`
      UPDATE despesas_fixas
      SET descricao = ?, valor = ?, categoria_id = ?, dia_vencimento = ?, observacoes = ?, ativa = ?, periodicidade = ?, intervalo_repeticao = ?, data_base = ?
      WHERE id = ?
    `).run(descricao, valor, categoriaId, diaVencimento, observacoes || null, ativa, periodicidade, intervaloRepeticao, dataBase, despesaId);

    if (info.changes === 0) return res.status(404).json({ error: 'Despesa fixa não encontrada' });

    garantirLancamentosDespesasFixas();

    registrarEvento(req, {
      acao: 'financeiro.despesa_fixa_atualizada',
      entidade: 'despesa_fixa',
      entidadeId: despesaId,
      descricao: `Despesa fixa ${descricao} atualizada`,
      detalhes: { valor, dia_vencimento: diaVencimento, ativa, periodicidade, intervalo_repeticao: intervaloRepeticao, data_base: dataBase },
    });

    res.json({ mensagem: 'Despesa fixa atualizada com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.desativarDespesaFixa = (req, res, next) => {
  try {
    const despesaId = Number(req.params.id);
    if (!despesaId) return res.status(400).json({ error: 'Despesa fixa inválida' });

    const despesa = db.prepare('SELECT descricao FROM despesas_fixas WHERE id = ?').get(despesaId);
    if (!despesa) return res.status(404).json({ error: 'Despesa fixa não encontrada' });

    db.prepare('UPDATE despesas_fixas SET ativa = 0 WHERE id = ?').run(despesaId);

    registrarEvento(req, {
      acao: 'financeiro.despesa_fixa_desativada',
      entidade: 'despesa_fixa',
      entidadeId: despesaId,
      descricao: `Despesa fixa ${despesa.descricao} desativada`,
    });

    res.json({ mensagem: 'Despesa fixa desativada com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.contasProximasVencer = (req, res, next) => {
  try {
    const dias = req.query.dias || 7;
    const itens = obterAlertasVencimento(dias);
    res.json({ itens, resumo_atrasos: obterResumoAlertasAtraso(itens) });
  } catch (error) {
    next(error);
  }
};
