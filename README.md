# SGB Stock

SGB Stock e um sistema web para operacao de loja com foco em estoque, vendas, clientes, fornecedores e financeiro em uma unica interface.

Foi pensado para o dia a dia operacional: cadastrar produtos, controlar variacoes, registrar vendas, acompanhar pagamentos e manter visibilidade do caixa sem depender de varias ferramentas separadas.

## Rode no localhost em poucos passos

Para abrir o projeto localmente agora:

```bash
npm install
npm start
```

Depois acesse no navegador:

```text
http://localhost:3000
```

Para desenvolvimento com reinicio automatico do servidor:

```bash
npm install
npm run dev
```

O sistema executa as migracoes automaticamente ao iniciar e cria o banco SQLite local caso ele ainda nao exista.

## Visao geral

O projeto combina:

- gestao de produtos com variacoes e estoque por local
- vendas com carrinho e controle de pagamento
- clientes com historico de pedidos
- fornecedores vinculados aos produtos
- financeiro integrado ao fluxo de vendas

## Principais recursos

### Produtos

- cadastro e edicao de produtos
- variacoes por tamanho e cor
- vinculacao de multiplos fornecedores
- controle de estoque por local
- desativacao e recuperacao de produtos
- busca por nome, SKU e fornecedor

### Vendas

- criacao de vendas com cliente cadastrado ou cliente avulso
- selecao pesquisavel de cliente e produto
- protecao contra venda acima do estoque disponivel
- status de pagamento: `pago` e `aguardando_pagamento`
- marcacao posterior de venda como paga
- cancelamento com reposicao automatica de estoque

### Clientes

- cadastro e edicao
- historico de pedidos por cliente
- visualizacao paginada em cards expansivos

### Fornecedores

- cadastro e edicao
- vinculacao com produtos
- desativacao sem exclusao fisica do registro

### Financeiro

- lancamentos manuais
- receitas geradas automaticamente por vendas
- sincronizacao com status de pagamento
- visao de saldo e fluxo por periodo

## Stack

- Node.js
- Express
- SQLite com better-sqlite3
- dotenv
- frontend estatico servido pelo proprio backend

## Como funciona

O backend serve tanto a API quanto o frontend.

- frontend em `public/`
- API em `/api/*`
- servidor principal em `server.js`
- controllers e rotas em `src/`
- banco e migracoes em `database/`

Ao iniciar o projeto:

1. as variaveis de ambiente sao carregadas
2. a conexao com o SQLite e criada
3. as migracoes sao executadas automaticamente
4. a aplicacao sobe em `http://localhost:3000`

## Estrutura do projeto

```text
database/
  db.js
  migrations/
public/
  index.html
  assets/
  pages/
src/
  controllers/
  middlewares/
  routes/
server.js
package.json
```

## Scripts

### `npm start`

Inicia o servidor da aplicacao.

### `npm run dev`

Inicia o servidor com `nodemon` para desenvolvimento.

### `npm test`

Script placeholder atual. Ainda nao ha suite de testes automatizados configurada.

## Ambiente

Requisitos recomendados:

- Node.js 18+
- npm

Variaveis opcionais:

```env
PORT=3000
DB_PATH=./database/erp.db
```

Se nenhuma configuracao for informada, o projeto usa esses valores padrao.

## API principal

Rotas principais expostas pelo servidor:

- `/api/produtos`
- `/api/clientes`
- `/api/fornecedores`
- `/api/vendas`
- `/api/financeiro`
- `/api/locais`

## Objetivo do projeto

O foco do SGB Stock e oferecer uma base simples, pratica e extensivel para operacao comercial local, com uma curva de uso curta e uma estrutura de codigo facil de evoluir.

## Repositorio

```text
https://github.com/sgalbiero/sgb-stock.git
```