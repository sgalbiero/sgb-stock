const db = require('../../database/db');
const {
  normalizarLogin,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  gerarDataExpiracaoSessao,
} = require('../services/auth.service');
const { parseCookies } = require('../middlewares/auth');
const { registrarEvento, registrarEventoBase } = require('../services/audit.service');

function definirCookieSessao(res, token, maxAgeSegundos = 60 * 60 * 24 * 7) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sgb_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSegundos}${secure}`);
}

function limparCookieSessao(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sgb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

function limparSessoesExpiradas() {
  db.prepare("DELETE FROM sessoes_usuario WHERE expira_em <= datetime('now', 'localtime')").run();
}

exports.login = (req, res, next) => {
  try {
    const login = normalizarLogin(req.body.login);
    const senha = String(req.body.senha || '');

    if (!login || !senha) {
      return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    limparSessoesExpiradas();

    const usuario = db.prepare(`
      SELECT id, nome, login, senha_hash, perfil, ativo
      FROM usuarios
      WHERE login = ?
    `).get(login);

    if (!usuario || !usuario.ativo || !verifyPassword(senha, usuario.senha_hash)) {
      return res.status(401).json({ error: 'Login ou senha inválidos' });
    }

    const token = generateSessionToken();
    db.prepare(`
      INSERT INTO sessoes_usuario (usuario_id, token_hash, expira_em)
      VALUES (?, ?, ?)
    `).run(usuario.id, hashToken(token), gerarDataExpiracaoSessao());

    definirCookieSessao(res, token);

    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        perfil: usuario.perfil,
      }
    });

    registrarEventoBase({
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      usuarioLogin: usuario.login,
      usuarioPerfil: usuario.perfil,
      acao: 'auth.login',
      entidade: 'sessao',
      descricao: 'Login realizado no sistema',
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.me = (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

  res.json({ usuario: req.user });
};

exports.logout = (req, res, next) => {
  try {
    const usuario = req.user;
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.sgb_session;

    if (token) {
      db.prepare('DELETE FROM sessoes_usuario WHERE token_hash = ?').run(hashToken(token));
    }

    limparCookieSessao(res);
    res.json({ mensagem: 'Logout realizado com sucesso' });

    if (usuario) {
      registrarEvento(req, {
        acao: 'auth.logout',
        entidade: 'sessao',
        descricao: 'Logout realizado no sistema',
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.listarUsuarios = (req, res, next) => {
  try {
    const usuarios = db.prepare(`
      SELECT id, nome, login, perfil, ativo, criado_em
      FROM usuarios
      ORDER BY nome COLLATE NOCASE, login COLLATE NOCASE
    `).all();

    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

exports.criarUsuario = (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const login = normalizarLogin(req.body.login);
    const senha = String(req.body.senha || '');
    const perfil = req.body.perfil;

    if (!nome || !login || !senha || !['admin', 'vendedor'].includes(perfil)) {
      return res.status(400).json({ error: 'Nome, login, senha e perfil válido são obrigatórios' });
    }

    const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login);
    if (existente) return res.status(400).json({ error: 'Já existe um usuário com esse login' });

    const info = db.prepare(`
      INSERT INTO usuarios (nome, login, senha_hash, perfil, ativo)
      VALUES (?, ?, ?, ?, 1)
    `).run(nome, login, hashPassword(senha), perfil);

    registrarEvento(req, {
      acao: 'usuario.criado',
      entidade: 'usuario',
      entidadeId: info.lastInsertRowid,
      descricao: `Usuário ${nome} criado`,
      detalhes: { login, perfil },
    });

    res.status(201).json({ id: info.lastInsertRowid, mensagem: 'Usuário criado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.atualizarUsuario = (req, res, next) => {
  try {
    const usuarioId = Number(req.params.id);
    const nome = String(req.body.nome || '').trim();
    const login = normalizarLogin(req.body.login);
    const perfil = req.body.perfil;
    const ativo = req.body.ativo ? 1 : 0;

    if (!usuarioId || !nome || !login || !['admin', 'vendedor'].includes(perfil)) {
      return res.status(400).json({ error: 'Nome, login e perfil válido são obrigatórios' });
    }

    const usuarioAtual = db.prepare('SELECT id, perfil, ativo FROM usuarios WHERE id = ?').get(usuarioId);
    if (!usuarioAtual) return res.status(404).json({ error: 'Usuário não encontrado' });

    const outroUsuario = db.prepare('SELECT id FROM usuarios WHERE login = ? AND id != ?').get(login, usuarioId);
    if (outroUsuario) return res.status(400).json({ error: 'Já existe um usuário com esse login' });

    const removerAdmin = usuarioAtual.perfil === 'admin' && (perfil !== 'admin' || ativo === 0);
    if (removerAdmin) {
      const totalAdminsAtivos = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE perfil = 'admin' AND ativo = 1").get().total;
      if (totalAdminsAtivos <= 1) {
        return res.status(400).json({ error: 'É necessário manter ao menos um administrador ativo' });
      }
    }

    const info = db.prepare(`
      UPDATE usuarios
      SET nome = ?, login = ?, perfil = ?, ativo = ?
      WHERE id = ?
    `).run(nome, login, perfil, ativo, usuarioId);

    if (info.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    registrarEvento(req, {
      acao: 'usuario.atualizado',
      entidade: 'usuario',
      entidadeId: usuarioId,
      descricao: `Usuário ${nome} atualizado`,
      detalhes: { login, perfil, ativo },
    });

    res.json({ mensagem: 'Usuário atualizado com sucesso' });
  } catch (error) {
    next(error);
  }
};

exports.resetarSenhaUsuario = (req, res, next) => {
  try {
    const usuarioId = Number(req.params.id);
    const senha = String(req.body.senha || '');

    if (!usuarioId || !senha) {
      return res.status(400).json({ error: 'Nova senha é obrigatória' });
    }

    const info = db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashPassword(senha), usuarioId);
    if (info.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    db.prepare('DELETE FROM sessoes_usuario WHERE usuario_id = ?').run(usuarioId);

    registrarEvento(req, {
      acao: 'usuario.senha_resetada',
      entidade: 'usuario',
      entidadeId: usuarioId,
      descricao: `Senha do usuário #${usuarioId} redefinida`,
    });

    res.json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (error) {
    next(error);
  }
};