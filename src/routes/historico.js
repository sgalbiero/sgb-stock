const express = require('express');
const router = express.Router();
const historicoController = require('../controllers/historico.controller');

router.get('/exportar.csv', historicoController.exportarCsv);
router.get('/', historicoController.listar);

module.exports = router;