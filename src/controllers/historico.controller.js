const db = require('../../database/db');
const { obterRotuloAcao, obterRotuloEntidade } = require('../services/audit.service');

function parseDetalhes(item) {
  return item.detalhes_json ? JSON.parse(item.detalhes_json) : null;
}

function enriquecerEvento(item) {
  return {
    ...item,
    acao_label: obterRotuloAcao(item.acao),
    entidade_label: obterRotuloEntidade(item.entidade),
    detalhes: parseDetalhes(item),
  };
}

function montarWhere(query) {
  const clauses = [];
  const params = [];

  const pesquisa = String(query.q || '').trim();
  if (pesquisa) {
    clauses.push(`(
      lower(a.descricao) LIKE lower(?)
      OR lower(a.acao) LIKE lower(?)
      OR lower(a.entidade) LIKE lower(?)
      OR lower(COALESCE(a.usuario_nome, '')) LIKE lower(?)
      OR lower(COALESCE(a.usuario_login, '')) LIKE lower(?)
      OR lower(COALESCE(a.detalhes_json, '')) LIKE lower(?)
    )`);
    const termo = `%${pesquisa}%`;
    params.push(termo, termo, termo, termo, termo, termo);
  }

  const entidade = String(query.entidade || '').trim();
  if (entidade) {
    clauses.push('a.entidade = ?');
    params.push(entidade);
  }

  const acao = String(query.acao || '').trim();
  if (acao) {
    clauses.push('a.acao = ?');
    params.push(acao);
  }

  const usuarioId = Number.parseInt(query.usuario_id, 10);
  if (Number.isInteger(usuarioId) && usuarioId > 0) {
    clauses.push('a.usuario_id = ?');
    params.push(usuarioId);
  }

  const dataInicial = String(query.data_inicial || '').trim();
  if (dataInicial) {
    clauses.push("date(a.criado_em) >= date(?)");
    params.push(dataInicial);
  }

  const dataFinal = String(query.data_final || '').trim();
  if (dataFinal) {
    clauses.push("date(a.criado_em) <= date(?)");
    params.push(dataFinal);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function obterFacetas() {
  return {
    entidades: db.prepare('SELECT DISTINCT entidade FROM auditoria_eventos ORDER BY entidade ASC').all().map(item => ({
      valor: item.entidade,
      label: obterRotuloEntidade(item.entidade),
    })),
    acoes: db.prepare('SELECT DISTINCT acao FROM auditoria_eventos ORDER BY acao ASC').all().map(item => ({
      valor: item.acao,
      label: obterRotuloAcao(item.acao),
    })),
    usuarios: db.prepare(`
      SELECT DISTINCT usuario_id as id, usuario_nome as nome, usuario_login as login
      FROM auditoria_eventos
      WHERE usuario_id IS NOT NULL
      ORDER BY usuario_nome COLLATE NOCASE ASC, usuario_login COLLATE NOCASE ASC
    `).all(),
  };
}

function obterEventos(query, options = {}) {
  const where = montarWhere(query);
  const limit = options.limit ? 'LIMIT ? OFFSET ?' : '';
  const params = options.limit
    ? [...where.params, options.limit, options.offset || 0]
    : where.params;

  return db.prepare(`
    SELECT a.*
    FROM auditoria_eventos a
    ${where.sql}
    ORDER BY a.criado_em DESC, a.id DESC
    ${limit}
  `).all(...params).map(enriquecerEvento);
}

function escaparCsv(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor).replace(/"/g, '""');
  return /[";,\n]/.test(texto) ? `"${texto}"` : texto;
}

exports.listar = (req, res, next) => {
  try {
    const pagina = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.pageSize, 10) || 20));
    const offset = (pagina - 1) * pageSize;
    const where = montarWhere(req.query);

    const total = db.prepare(`SELECT COUNT(*) as total FROM auditoria_eventos a ${where.sql}`).get(...where.params).total;
    const itens = obterEventos(req.query, { limit: pageSize, offset });

    const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

    res.json({
      itens,
      paginacao: {
        pagina,
        pageSize,
        totalItens: total,
        totalPaginas,
        temAnterior: pagina > 1,
        temProxima: pagina < totalPaginas,
      },
      facetas: obterFacetas(),
    });
  } catch (error) {
    next(error);
  }
};

exports.exportarCsv = (req, res, next) => {
  try {
    const itens = obterEventos(req.query);
    const linhas = [
      ['Data', 'Usuario', 'Login', 'Perfil', 'Acao', 'Entidade', 'ID da entidade', 'Descricao', 'Detalhes'],
      ...itens.map(item => ([
        item.criado_em,
        item.usuario_nome || 'Sistema',
        item.usuario_login || '',
        item.usuario_perfil || '',
        item.acao_label,
        item.entidade_label,
        item.entidade_id || '',
        item.descricao,
        item.detalhes ? JSON.stringify(item.detalhes) : '',
      ])),
    ];

    const csv = linhas.map(colunas => colunas.map(escaparCsv).join(';')).join('\n');
    const dataArquivo = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historico-auditoria-${dataArquivo}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
};