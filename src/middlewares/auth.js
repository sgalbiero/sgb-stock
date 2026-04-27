const db = require('../../database/db');
const { hashToken } = require('../services/auth.service');

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const key = item.slice(0, separatorIndex);
      const value = decodeURIComponent(item.slice(separatorIndex + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function attachAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.sgb_session;

    req.user = null;
    if (!token) return next();

    db.prepare("DELETE FROM sessoes_usuario WHERE expira_em <= datetime('now', 'localtime')").run();

    const sessao = db.prepare(`
      SELECT u.id, u.nome, u.login, u.perfil
      FROM sessoes_usuario s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?
        AND s.expira_em > datetime('now', 'localtime')
        AND u.ativo = 1
      LIMIT 1
    `).get(hashToken(token));

    if (sessao) {
      req.user = {
        id: sessao.id,
        nome: sessao.nome,
        login: sessao.login,
        perfil: sessao.perfil,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar' });
    if (!roles.includes(req.user.perfil)) return res.status(403).json({ error: 'Você não tem permissão para acessar este recurso' });
    next();
  };
}

module.exports = {
  parseCookies,
  attachAuth,
  requireAuth,
  requireRole,
};
