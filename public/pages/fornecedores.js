/* fornecedores.js — Listagem, cadastro, edição e produtos vinculados */

const PageFornecedores = (() => {

  let _todos = [];

  function podeGerenciar() {
    return Auth.canManageFornecedores();
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🏭 Fornecedores</h1>
          <p class="page-subtitle">${podeGerenciar() ? 'Gerencie seus fornecedores' : 'Visualize fornecedores e produtos vinculados'}</p>
        </div>
        ${podeGerenciar() ? '<button class="btn btn-primary" id="btn-novo-fornecedor">+ Novo Fornecedor</button>' : ''}
      </div>
      <div class="toolbar">
        <input class="search-input" id="busca-fornecedor" type="text" placeholder="Buscar por nome..." />
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>Cidade</th><th>Observações</th><th>Ações</th></tr></thead>
            <tbody id="tabela-fornecedores"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-fornecedor')?.addEventListener('click', () => abrirFormulario());
    document.getElementById('busca-fornecedor').addEventListener('input', e => filtrar(e.target.value));

    await carregar();
  }

  async function carregar() {
    try {
      _todos = await API.fornecedores.listar();
      renderTabela(_todos);
    } catch(e) {
      toast('Erro ao carregar fornecedores: ' + e.message, 'error');
    }
  }

  function filtrar(termo) {
    const t = termo.toLowerCase();
    renderTabela(_todos.filter(f => f.nome.toLowerCase().includes(t)));
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-fornecedores');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🏭</div><p>Nenhum fornecedor encontrado.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(f => `
      <tr>
        <td style="color:var(--text-faint)">#${f.id}</td>
        <td><strong>${f.nome}</strong></td>
        <td>${f.telefone || '—'}</td>
        <td>${f.cidade || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.observacoes || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-ghost btn-sm" onclick="PageFornecedores.verProdutos(${f.id})" title="Produtos vinculados">📦</button>
            ${podeGerenciar() ? `<button class="btn btn-ghost btn-sm" onclick="PageFornecedores.editar(${f.id})" title="Editar">✏️</button>` : ''}
            ${podeGerenciar() ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageFornecedores.desativar(${f.id}, '${f.nome}')" title="Desativar">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function abrirFormulario(fornecedor = null) {
    if (!podeGerenciar()) {
      toast('Somente administradores podem alterar fornecedores.', 'error');
      return;
    }

    const titulo = fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor';
    Modal.open(titulo, `
      <form id="form-fornecedor">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="forn-nome" type="text" value="${fornecedor?.nome || ''}" required placeholder="Nome do fornecedor" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-control" id="forn-telefone" type="text" value="${fornecedor?.telefone || ''}" placeholder="(00) 00000-0000" />
          </div>
          <div class="form-group">
            <label class="form-label">CEP</label>
            <input class="form-control" id="forn-cep" type="text" value="${fornecedor?.cep || ''}" placeholder="00000-000" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Endereço</label>
            <input class="form-control" id="forn-endereco" type="text" value="${fornecedor?.endereco || ''}" placeholder="Rua, número" />
          </div>
          <div class="form-group">
            <label class="form-label">Cidade</label>
            <input class="form-control" id="forn-cidade" type="text" value="${fornecedor?.cidade || ''}" placeholder="Cidade" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-control" id="forn-obs" placeholder="Condições de pagamento, prazo de entrega...">${fornecedor?.observacoes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    Utils.mascararTelefone(document.getElementById('forn-telefone'));
    Utils.mascararCep(document.getElementById('forn-cep'));

    document.getElementById('form-fornecedor').addEventListener('submit', async e => {
      e.preventDefault();
      const dados = {
        nome: document.getElementById('forn-nome').value,
        telefone: document.getElementById('forn-telefone').value,
        cep: document.getElementById('forn-cep').value,
        endereco: document.getElementById('forn-endereco').value,
        cidade: document.getElementById('forn-cidade').value,
        observacoes: document.getElementById('forn-obs').value,
      };
      try {
        if (fornecedor) {
          await API.fornecedores.atualizar(fornecedor.id, dados);
          toast('Fornecedor atualizado!', 'success');
        } else {
          await API.fornecedores.criar(dados);
          toast('Fornecedor criado!', 'success');
        }
        Modal.close();
        await carregar();
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  async function editar(id) {
    if (!podeGerenciar()) {
      toast('Somente administradores podem editar fornecedores.', 'error');
      return;
    }

    try {
      const f = await API.fornecedores.obter(id);
      abrirFormulario(f);
    } catch(e) {
      toast('Erro ao carregar fornecedor.', 'error');
    }
  }

  async function verProdutos(id) {
    try {
      const f = await API.fornecedores.obter(id);
      const prods = f.produtosVinculados || [];
      Modal.open(`📦 Produtos — ${f.nome}`, `
        ${prods.length === 0
          ? `<div class="empty-state" style="padding:24px 0"><div class="empty-icon">📦</div><p>Nenhum produto vinculado.</p></div>`
          : `<div class="table-wrapper">
              <table>
                <thead><tr><th>SKU</th><th>Nome</th></tr></thead>
                <tbody>
                  ${prods.map(p => `<tr><td><code>${p.sku}</code></td><td>${p.nome}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      `);
    } catch(e) {
      toast('Erro ao carregar produtos.', 'error');
    }
  }

  async function desativar(id, nome) {
    if (!podeGerenciar()) {
      toast('Somente administradores podem desativar fornecedores.', 'error');
      return;
    }

    const ok = await Modal.confirm(
      `Deseja desativar o fornecedor <strong>"${nome}"</strong>?<br><small style="color:var(--text-muted)">Ele não aparecerá mais nas listagens.</small>`,
      { titulo: 'Desativar Fornecedor', textoBotaoOk: '🗑️ Desativar', icone: '🏭' }
    );
    if (!ok) return;
    try {
      await API.fornecedores.desativar(id);
      toast('Fornecedor desativado.', 'success');
      await carregar();
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  return { render, editar, verProdutos, desativar };
})();
