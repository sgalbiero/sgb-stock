require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const errorHandler = require('./src/middlewares/errorHandler');

// Importar rotas
const produtosRoutes = require('./src/routes/produtos');
const clientesRoutes = require('./src/routes/clientes');
const fornecedoresRoutes = require('./src/routes/fornecedores');
const vendasRoutes = require('./src/routes/vendas');
const financeiroRoutes = require('./src/routes/financeiro');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas API
app.use('/api/produtos', produtosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/financeiro', financeiroRoutes);

// Locais de estoque (endpoint simples)
app.get('/api/locais', (req, res) => {
  try {
    const locais = db.prepare('SELECT * FROM locais_estoque ORDER BY nome').all();
    res.json(locais);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Tratamento de erros
app.use(errorHandler);

// SPA fallback — serve index.html para qualquer rota não-API
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ERP rodando em http://localhost:${PORT}`);
});
