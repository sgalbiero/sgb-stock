const express = require('express');
const router = express.Router();
const vendasController = require('../controllers/vendas.controller');

router.get('/', vendasController.listar);
router.get('/:id', vendasController.obter);
router.post('/', vendasController.criar);
router.put('/:id/cliente', vendasController.vincularCliente);
router.put('/:id/pagar', vendasController.marcarComoPaga);
router.put('/:id/cancelar', vendasController.cancelar);

module.exports = router;
