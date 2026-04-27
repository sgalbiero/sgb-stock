const express = require('express');
const router = express.Router();
const fornecedoresController = require('../controllers/fornecedores.controller');

router.get('/', fornecedoresController.listar);
router.get('/:id', fornecedoresController.obter);
router.post('/', fornecedoresController.criar);
router.put('/:id', fornecedoresController.atualizar);
router.delete('/:id', fornecedoresController.desativar);

module.exports = router;
