const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.get('/usuarios', requireRole('admin'), authController.listarUsuarios);
router.post('/usuarios', requireRole('admin'), authController.criarUsuario);
router.put('/usuarios/:id', requireRole('admin'), authController.atualizarUsuario);
router.put('/usuarios/:id/senha', requireRole('admin'), authController.resetarSenhaUsuario);

module.exports = router;