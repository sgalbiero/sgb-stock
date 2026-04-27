const express = require('express');
const router = express.Router();
const locaisController = require('../controllers/locais.controller');
const { requireRole } = require('../middlewares/auth');

router.get('/', locaisController.listar);
router.post('/', requireRole('admin'), locaisController.criar);
router.put('/:id', requireRole('admin'), locaisController.atualizar);
router.delete('/:id', requireRole('admin'), locaisController.excluir);

module.exports = router;