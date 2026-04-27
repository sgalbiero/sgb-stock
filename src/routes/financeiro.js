const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiro.controller');

router.get('/', financeiroController.listar);
router.get('/saldo', financeiroController.saldo);
router.get('/fluxo', financeiroController.fluxo);
router.get('/categorias', financeiroController.categorias);
router.post('/', financeiroController.criar);
router.put('/:id', financeiroController.atualizar);
router.put('/:id/pagar', financeiroController.pagar);
router.delete('/:id', financeiroController.excluir);

module.exports = router;
