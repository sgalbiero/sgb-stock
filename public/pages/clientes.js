/* clientes.js — Listagem, cadastro, edição e histórico de compras */

const PageClientes = (() => {

  let _todos = [];

  function badgeStatusPagamento(statusPagamento) {
    return statusPagamento === 'pago' ? 'badge-green' : 'badge-yellow';
  }

  function labelStatusPagamento(statusPagamento) {
    return statusPagamento === 'pago' ? 'Pago' : 'Aguardando pagamento';
  }

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
      Modal.open(`📋 Histórico`, `
        <div>
          <div style="margin-bottom:16px">
            <h3 id="cliente-historico-titulo" style="margin:0;font-size:18px"></h3>
            <p style="margin:6px 0 0;color:var(--text-muted);font-size:13px">Pedidos paginados com detalhes expansíveis.</p>
          </div>
          <div id="cliente-historico-conteudo"><div class="spinner" style="margin:auto"></div></div>
        </div>
      `);

      document.querySelector('.modal-box').style.maxWidth = '820px';

      async function carregarPagina(page = 1) {
        const resposta = await API.clientes.historico(id, { page, pageSize: 5 });
        const { cliente, pedidos = [], paginacao } = resposta;

        document.getElementById('cliente-historico-titulo').textContent = `Histórico — ${cliente.nome}`;

        const conteudo = document.getElementById('cliente-historico-conteudo');
        if (!pedidos.length) {
          conteudo.innerHTML = `<div class="empty-state" style="padding:30px 0"><div class="empty-icon">🛒</div><p>Sem compras registradas.</p></div>`;
          return;
        }

        conteudo.innerHTML = `
          <div style="display:grid;gap:12px">
            ${pedidos.map(v => `
              <div style="border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-elevated);overflow:hidden">
                <button type="button" class="btn btn-ghost" data-historico-toggle="${v.id}" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-radius:0">
                  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;text-align:left">
                    <strong>${Utils.dataHora(v.criado_em)}</strong>
                    <span>${Utils.moeda(v.total)}</span>
                    <span class="badge ${badgeStatusPagamento(v.status_pagamento)}">${labelStatusPagamento(v.status_pagamento)}</span>
                  </div>
                  <span id="historico-seta-${v.id}" style="font-size:14px;color:var(--text-muted)">▼</span>
                </button>
                <div id="historico-detalhes-${v.id}" style="display:none;padding:0 16px 16px 16px;background:var(--bg)">
                  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:13px;color:var(--text-muted)">
                    <span><strong>Pedido:</strong> #${v.id}</span>
                    <span><strong>Status:</strong> ${v.status}</span>
                    <span><strong>Pagamento:</strong> ${Utils.formaPagamentoLabel(v.forma_pagamento)}</span>
                  </div>
                  ${(v.itens || []).map(item => `
                    <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--border);align-items:flex-start">
                      <div>
                        <div style="font-weight:600">${item.produto_nome}</div>
                        <div style="font-size:12px;color:var(--text-muted)">Tam ${item.tamanho} · ${item.cor} · Qtd ${item.quantidade}</div>
                      </div>
                      <div style="white-space:nowrap;font-weight:600">${Utils.moeda(item.preco_unit * item.quantidade)}</div>
                    </div>
                  `).join('')}
                  ${v.observacoes ? `<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">📝 ${v.observacoes}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap">
            <div style="font-size:13px;color:var(--text-muted)">Página ${paginacao.pagina} de ${paginacao.totalPaginas} · ${paginacao.totalItens} pedido(s)</div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-outline btn-sm" id="hist-pag-anterior" ${paginacao.temAnterior ? '' : 'disabled'}>← Anterior</button>
              <button type="button" class="btn btn-outline btn-sm" id="hist-pag-proxima" ${paginacao.temProxima ? '' : 'disabled'}>Próxima →</button>
            </div>
          </div>
        `;

        pedidos.forEach(v => {
          document.querySelector(`[data-historico-toggle="${v.id}"]`).addEventListener('click', () => {
            const detalhes = document.getElementById(`historico-detalhes-${v.id}`);
            const seta = document.getElementById(`historico-seta-${v.id}`);
            const aberto = detalhes.style.display !== 'none';
            detalhes.style.display = aberto ? 'none' : 'block';
            seta.textContent = aberto ? '▼' : '▲';
          });
        });

        document.getElementById('hist-pag-anterior')?.addEventListener('click', () => carregarPagina(paginacao.pagina - 1));
        document.getElementById('hist-pag-proxima')?.addEventListener('click', () => carregarPagina(paginacao.pagina + 1));
      }

      await carregarPagina(1);
    } catch(e) {
      toast('Erro ao carregar histórico.', 'error');
    }
  }

  return { render, editar, verHistorico };
})();
