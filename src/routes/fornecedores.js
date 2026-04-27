const express = require('express');
const router = express.Router();
const fornecedoresController = require('../controllers/fornecedores.controller');
const { requireRole } = require('../middlewares/auth');

router.get('/', fornecedoresController.listar);
router.get('/:id', fornecedoresController.obter);
router.post('/', requireRole('admin'), fornecedoresController.criar);
router.put('/:id', requireRole('admin'), fornecedoresController.atualizar);
router.delete('/:id', requireRole('admin'), fornecedoresController.desativar);

module.exports = router;
