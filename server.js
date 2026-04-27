require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
require('./database/migrations/run_migrations');
const errorHandler = require('./src/middlewares/errorHandler');
const { attachAuth, requireAuth, requireRole } = require('./src/middlewares/auth');

// Importar rotas
const authRoutes = require('./src/routes/auth');
const produtosRoutes = require('./src/routes/produtos');
const clientesRoutes = require('./src/routes/clientes');
const fornecedoresRoutes = require('./src/routes/fornecedores');
const vendasRoutes = require('./src/routes/vendas');
const financeiroRoutes = require('./src/routes/financeiro');
const locaisRoutes = require('./src/routes/locais');
const historicoRoutes = require('./src/routes/historico');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(attachAuth);

// Rotas API
app.use('/api/auth', authRoutes);
app.use('/api/produtos', requireAuth, produtosRoutes);
app.use('/api/clientes', requireAuth, clientesRoutes);
app.use('/api/fornecedores', requireAuth, fornecedoresRoutes);
app.use('/api/vendas', requireAuth, vendasRoutes);
app.use('/api/financeiro', requireRole('admin'), financeiroRoutes);
app.use('/api/locais', requireAuth, locaisRoutes);
app.use('/api/historico', requireRole('admin'), historicoRoutes);

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
