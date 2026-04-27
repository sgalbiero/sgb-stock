const db = require('../../database/db');

const ACTION_LABELS = {
  'auth.login': 'Login no sistema',
  'auth.logout': 'Logout do sistema',
  'usuario.criado': 'Usuário criado',
  'usuario.atualizado': 'Usuário atualizado',
  'usuario.senha_resetada': 'Senha redefinida',
  'cliente.criado': 'Cliente criado',
  'cliente.atualizado': 'Cliente atualizado',
  'fornecedor.criado': 'Fornecedor criado',
  'fornecedor.atualizado': 'Fornecedor atualizado',
  'fornecedor.desativado': 'Fornecedor desativado',
  'local.criado': 'Local de estoque criado',
  'local.atualizado': 'Local de estoque atualizado',
  'local.excluido': 'Local de estoque excluído',
  'produto.criado': 'Produto criado',
  'produto.atualizado': 'Produto atualizado',
  'produto.desativado': 'Produto desativado',
  'produto.recuperado': 'Produto recuperado',
  'produto.variacao_criada': 'Variação criada',
  'produto.variacao_desativada': 'Variação desativada',
  'estoque.entrada': 'Entrada de estoque',
  'venda.criada': 'Venda criada',
  'venda.paga': 'Venda marcada como paga',
  'venda.cliente_vinculado': 'Cliente vinculado à venda',
  'venda.cancelada': 'Venda cancelada',
  'financeiro.lancamento_criado': 'Lançamento financeiro criado',
  'financeiro.lancamento_atualizado': 'Lançamento financeiro atualizado',
  'financeiro.lancamento_pago': 'Lançamento financeiro pago',
  'financeiro.lancamento_excluido': 'Lançamento financeiro excluído',
  'financeiro.categoria_criada': 'Categoria financeira criada',
  'financeiro.categoria_atualizada': 'Categoria financeira atualizada',
  'financeiro.categoria_excluida': 'Categoria financeira excluída',
  'financeiro.despesa_fixa_criada': 'Despesa fixa criada',
  'financeiro.despesa_fixa_atualizada': 'Despesa fixa atualizada',
  'financeiro.despesa_fixa_desativada': 'Despesa fixa desativada',
};

const ENTITY_LABELS = {
  sessao: 'Sessão',
  usuario: 'Usuário',
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  local_estoque: 'Local de estoque',
  produto: 'Produto',
  produto_variacao: 'Variação de produto',
  estoque: 'Estoque',
  venda: 'Venda',
  lancamento_financeiro: 'Lançamento financeiro',
  categoria_financeira: 'Categoria financeira',
  despesa_fixa: 'Despesa fixa',
};

const insertEvento = db.prepare(`
  INSERT INTO auditoria_eventos (
    usuario_id,
    usuario_nome,
    usuario_login,
    usuario_perfil,
    acao,
    entidade,
    entidade_id,
    descricao,
    detalhes_json,
    ip,
    user_agent
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function normalizarDetalhes(detalhes) {
  if (!detalhes) return null;
  try {
    return JSON.stringify(detalhes);
  } catch (error) {
    return JSON.stringify({ erro: 'Falha ao serializar detalhes' });
  }
}

function extrairIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

function registrarEventoBase(evento) {
  try {
    insertEvento.run(
      evento.usuarioId || null,
      evento.usuarioNome || null,
      evento.usuarioLogin || null,
      evento.usuarioPerfil || null,
      evento.acao,
      evento.entidade,
      evento.entidadeId || null,
      evento.descricao,
      normalizarDetalhes(evento.detalhes),
      evento.ip || null,
      evento.userAgent || null
    );
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error.message);
  }
}

function registrarEvento(req, evento) {
  registrarEventoBase({
    usuarioId: req.user?.id,
    usuarioNome: req.user?.nome,
    usuarioLogin: req.user?.login,
    usuarioPerfil: req.user?.perfil,
    ip: extrairIp(req),
    userAgent: req.headers['user-agent'] || null,
    ...evento,
  });
}

function obterRotuloAcao(acao) {
  return ACTION_LABELS[acao] || acao;
}

function obterRotuloEntidade(entidade) {
  return ENTITY_LABELS[entidade] || entidade;
}

module.exports = {
  ACTION_LABELS,
  ENTITY_LABELS,
  obterRotuloAcao,
  obterRotuloEntidade,
  registrarEvento,
  registrarEventoBase,
};