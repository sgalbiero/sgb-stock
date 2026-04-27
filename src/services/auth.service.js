const crypto = require('crypto');

function normalizarLogin(login) {
  return String(login || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;

  const [salt, originalHash] = storedHash.split(':');
  const candidateHash = crypto.scryptSync(String(password), salt, 64).toString('hex');

  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function gerarDataExpiracaoSessao(dias = 7) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  normalizarLogin,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  gerarDataExpiracaoSessao,
};