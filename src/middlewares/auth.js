// Esqueleto do middleware de autenticação, caso seja adicionada sessão no futuro.
// No momento, o MVP roda localmente sem login, conforme o PRD.

function authMiddleware(req, res, next) {
  // Para MVP local, passamos reto.
  next();
}

module.exports = authMiddleware;
