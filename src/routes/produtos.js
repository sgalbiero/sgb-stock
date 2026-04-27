const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtos.controller');

router.get('/', produtosController.listar);
router.get('/inativos', produtosController.listarInativos);
router.get('/:id', produtosController.obter);
router.post('/', produtosController.criar);
router.put('/:id', produtosController.atualizar);
router.put('/:id/recuperar', produtosController.recuperar);
router.delete('/:id', produtosController.desativar);

// Variações
router.post('/:id/variacoes', produtosController.adicionarVariacao);
router.delete('/variacoes/:variacao_id', produtosController.desativarVariacao);

// Estoque
router.post('/variacoes/:variacao_id/estoque', produtosController.entradaEstoque);

module.exports = router;
