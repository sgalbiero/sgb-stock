const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiro.controller');

router.get('/', financeiroController.listar);
router.get('/saldo', financeiroController.saldo);
router.get('/fluxo', financeiroController.fluxo);
router.get('/indicadores', financeiroController.indicadores);
router.get('/desempenho-produtos', financeiroController.desempenhoProdutos);
router.get('/serie-periodo', financeiroController.seriePeriodo);
router.get('/contas-proximas-vencer', financeiroController.contasProximasVencer);
router.get('/categorias', financeiroController.categorias);
router.get('/despesas-fixas', financeiroController.listarDespesasFixas);
router.post('/categorias', financeiroController.criarCategoria);
router.post('/despesas-fixas', financeiroController.criarDespesaFixa);
router.put('/categorias/:id', financeiroController.atualizarCategoria);
router.put('/despesas-fixas/:id', financeiroController.atualizarDespesaFixa);
router.delete('/categorias/:id', financeiroController.excluirCategoria);
router.delete('/despesas-fixas/:id', financeiroController.desativarDespesaFixa);
router.post('/', financeiroController.criar);
router.put('/:id', financeiroController.atualizar);
router.put('/:id/pagar', financeiroController.pagar);
router.delete('/:id', financeiroController.excluir);

module.exports = router;
