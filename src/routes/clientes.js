const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');

router.get('/', clientesController.listar);
router.get('/:id/historico', clientesController.historico);
router.get('/:id', clientesController.obter);
router.post('/', clientesController.criar);
router.put('/:id', clientesController.atualizar);

module.exports = router;
