const db = require('../db');

function up() {
  console.log('Iniciando migração: 002_seed_categories');

  const checkCategorias = db.prepare("SELECT COUNT(*) as count FROM categorias_financeiras").get();
  
  if (checkCategorias.count === 0) {
    const insertCategoria = db.prepare("INSERT INTO categorias_financeiras (nome, tipo) VALUES (?, ?)");
    
    // Default categories
    const categorias = [
      { nome: 'Venda', tipo: 'receita' },
      { nome: 'Fornecedor', tipo: 'despesa' },
      { nome: 'Aluguel', tipo: 'despesa' },
      { nome: 'Salário', tipo: 'despesa' },
      { nome: 'Água/Luz/Internet', tipo: 'despesa' },
      { nome: 'Impostos', tipo: 'despesa' },
      { nome: 'Outros', tipo: 'despesa' }
    ];

    const transaction = db.transaction((cats) => {
      for (const cat of cats) insertCategoria.run(cat.nome, cat.tipo);
    });

    transaction(categorias);
    console.log('Categorias financeiras padrão inseridas.');
  }

  const checkLocais = db.prepare("SELECT COUNT(*) as count FROM locais_estoque").get();
  if (checkLocais.count === 0) {
    const insertLocal = db.prepare("INSERT INTO locais_estoque (nome) VALUES (?)");
    insertLocal.run('Loja Principal');
    insertLocal.run('Depósito');
    console.log('Locais de estoque padrão inseridos.');
  }

  console.log('Migração concluída: 002_seed_categories');
}

module.exports = { up };
