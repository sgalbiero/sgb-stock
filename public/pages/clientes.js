/* clientes.js — Listagem, cadastro, edição e histórico de compras */

const PageClientes = (() => {

  let _todos = [];

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">👥 Clientes</h1>
          <p class="page-subtitle">Gerencie sua base de clientes</p>
        </div>
        <button class="btn btn-primary" id="btn-novo-cliente">+ Novo Cliente</button>
      </div>
      <div class="toolbar">
        <input class="search-input" id="busca-cliente" type="text" placeholder="Buscar por nome ou telefone..." />
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>Cidade</th><th>Cadastro</th><th>Ações</th></tr></thead>
            <tbody id="tabela-clientes"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-cliente').addEventListener('click', () => abrirFormulario());
    document.getElementById('busca-cliente').addEventListener('input', e => filtrar(e.target.value));

    await carregar();
  }

  async function carregar() {
    try {
      _todos = await API.clientes.listar();
      renderTabela(_todos);
    } catch(e) {
      toast('Erro ao carregar clientes: ' + e.message, 'error');
    }
  }

  function filtrar(termo) {
    const t = termo.toLowerCase();
    renderTabela(_todos.filter(c =>
      c.nome.toLowerCase().includes(t) ||
      (c.telefone || '').toLowerCase().includes(t)
    ));
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-clientes');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>Nenhum cliente encontrado.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(c => {
      const wa = Utils.whatsappLink(c.telefone);
      return `
        <tr>
          <td style="color:var(--text-faint)">#${c.id}</td>
          <td><strong>${c.nome}</strong></td>
          <td>
            ${c.telefone || '—'}
            ${wa ? `<a class="wa-link" href="${wa}" target="_blank" title="Abrir WhatsApp">💬</a>` : ''}
          </td>
          <td>${c.cidade || '—'}</td>
          <td>${Utils.data(c.criado_em)}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-ghost btn-sm" onclick="PageClientes.verHistorico(${c.id})" title="Histórico">📋</button>
              <button class="btn btn-ghost btn-sm" onclick="PageClientes.editar(${c.id})" title="Editar">✏️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function abrirFormulario(cliente = null) {
    const titulo = cliente ? 'Editar Cliente' : 'Novo Cliente';
    Modal.open(titulo, `
      <form id="form-cliente">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="cli-nome" type="text" value="${cliente?.nome || ''}" required placeholder="Nome completo" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Telefone</label>
            <input class="form-control" id="cli-telefone" type="text" value="${cliente?.telefone || ''}" placeholder="(00) 00000-0000" />
          </div>
          <div class="form-group">
            <label class="form-label">CEP</label>
            <input class="form-control" id="cli-cep" type="text" value="${cliente?.cep || ''}" placeholder="00000-000" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input class="form-control" id="cli-endereco" type="text" value="${cliente?.endereco || ''}" placeholder="Rua, número" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bairro</label>
            <input class="form-control" id="cli-bairro" type="text" value="${cliente?.bairro || ''}" placeholder="Bairro" />
          </div>
          <div class="form-group">
            <label class="form-label">Cidade</label>
            <input class="form-control" id="cli-cidade" type="text" value="${cliente?.cidade || ''}" placeholder="Cidade" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    Utils.mascararTelefone(document.getElementById('cli-telefone'));
    Utils.mascararCep(document.getElementById('cli-cep'));

    document.getElementById('form-cliente').addEventListener('submit', async e => {
      e.preventDefault();
      const dados = {
        nome: document.getElementById('cli-nome').value,
        telefone: document.getElementById('cli-telefone').value,
        cep: document.getElementById('cli-cep').value,
        endereco: document.getElementById('cli-endereco').value,
        bairro: document.getElementById('cli-bairro').value,
        cidade: document.getElementById('cli-cidade').value,
      };
      try {
        if (cliente) {
          await API.clientes.atualizar(cliente.id, dados);
          toast('Cliente atualizado!', 'success');
        } else {
          await API.clientes.criar(dados);
          toast('Cliente criado!', 'success');
        }
        Modal.close();
        await carregar();
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  async function editar(id) {
    try {
      const cliente = await API.clientes.obter(id);
      abrirFormulario(cliente);
    } catch(e) {
      toast('Erro ao carregar cliente.', 'error');
    }
  }

  async function verHistorico(id) {
    try {
      const cliente = await API.clientes.obter(id);
      const historico = cliente.historico || [];
      Modal.open(`📋 Histórico — ${cliente.nome}`, `
        ${historico.length === 0
          ? `<div class="empty-state" style="padding:30px 0"><div class="empty-icon">🛒</div><p>Sem compras registradas.</p></div>`
          : `<div class="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  ${historico.map(v => `
                    <tr>
                      <td><strong>#${v.id}</strong></td>
                      <td>${Utils.moeda(v.total)}</td>
                      <td><span class="badge ${v.status === 'concluida' ? 'badge-green' : 'badge-red'}">${v.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      `);
    } catch(e) {
      toast('Erro ao carregar histórico.', 'error');
    }
  }

  return { render, editar, verHistorico };
})();
