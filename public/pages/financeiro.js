/* financeiro.js — Painel financeiro, lançamentos e fluxo de caixa */

const PageFinanceiro = (() => {

  let _lancamentos = [];
  let _categorias = [];

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">💰 Financeiro</h1>
          <p class="page-subtitle">Controle de caixa, receitas e despesas</p>
        </div>
        <button class="btn btn-primary" id="btn-novo-lancamento">+ Novo Lançamento</button>
      </div>

      <!-- Saldo destacado -->
      <div id="fin-saldo-card" class="stats-grid" style="grid-template-columns: repeat(3, 1fr)">
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
      </div>

      <!-- Fluxo de Caixa -->
      <div class="card">
        <div class="card-title">📈 Fluxo de Caixa por Período</div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
          <div class="form-group" style="margin:0">
            <label class="form-label">De</label>
            <input class="form-control" id="fluxo-inicio" type="date" value="${_primeiroDiaMes()}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Até</label>
            <input class="form-control" id="fluxo-fim" type="date" value="${Utils.hoje()}" />
          </div>
          <button class="btn btn-outline" id="btn-fluxo">Calcular</button>
        </div>
        <div id="fin-fluxo"></div>
      </div>

      <!-- Listagem -->
      <div class="card">
        <div class="card-title">📋 Lançamentos</div>
        <div class="toolbar" style="margin-bottom:14px">
          <select class="form-control" id="filtro-tipo" style="max-width:160px">
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <select class="form-control" id="filtro-status" style="max-width:160px">
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
          <button class="btn btn-outline btn-sm" id="btn-aplicar-filtros">Filtrar</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tabela-lancamentos"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-lancamento').addEventListener('click', abrirFormulario);
    document.getElementById('btn-fluxo').addEventListener('click', carregarFluxo);
    document.getElementById('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);

    await Promise.all([carregarSaldo(), carregarFluxo(), carregar()]);
    _categorias = await API.financeiro.categorias();
  }

  function _primeiroDiaMes() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  }

  async function carregarSaldo() {
    try {
      const s = await API.financeiro.saldo();
      document.getElementById('fin-saldo-card').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Receitas (pago)</div>
          <div class="stat-value green">${Utils.moeda(s.receitas)}</div>
          <div class="stat-icon">📈</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Despesas (pago)</div>
          <div class="stat-value red">${Utils.moeda(s.despesas)}</div>
          <div class="stat-icon">📉</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Saldo Atual</div>
          <div class="stat-value ${s.saldo >= 0 ? 'green' : 'red'}">${Utils.moeda(s.saldo)}</div>
          <div class="stat-icon">${s.saldo >= 0 ? '💰' : '⚠️'}</div>
        </div>
      `;
    } catch(e) {
      document.getElementById('fin-saldo-card').innerHTML = `<div class="alert alert-danger">Erro ao carregar saldo.</div>`;
    }
  }

  async function carregarFluxo() {
    const inicio = document.getElementById('fluxo-inicio')?.value;
    const fim = document.getElementById('fluxo-fim')?.value;
    const el = document.getElementById('fin-fluxo');
    try {
      const f = await API.financeiro.fluxo({ inicio, fim });
      el.innerHTML = `
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="stat-card">
            <div class="stat-label">Entradas</div>
            <div class="stat-value green">${Utils.moeda(f.receitas)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Saídas</div>
            <div class="stat-value red">${Utils.moeda(f.despesas)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Resultado no Período</div>
            <div class="stat-value ${f.saldo >= 0 ? 'green' : 'red'}">${Utils.moeda(f.saldo)}</div>
          </div>
        </div>
      `;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-danger">Erro ao calcular fluxo.</div>`;
    }
  }

  async function carregar() {
    try {
      _lancamentos = await API.financeiro.listar();
      renderTabela(_lancamentos);
    } catch(e) {
      toast('Erro ao carregar lançamentos: ' + e.message, 'error');
    }
  }

  function aplicarFiltros() {
    const tipo = document.getElementById('filtro-tipo')?.value;
    const status = document.getElementById('filtro-status')?.value;
    let lista = [..._lancamentos];
    if (tipo) lista = lista.filter(l => l.tipo === tipo);
    if (status) lista = lista.filter(l => l.status === status);
    renderTabela(lista);
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-lancamentos');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💰</div><p>Nenhum lançamento encontrado.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(l => `
      <tr>
        <td style="white-space:nowrap">${Utils.data(l.criado_em)}</td>
        <td>
          <strong>${l.descricao}</strong>
          ${l.venda_id ? `<span style="font-size:11px;color:var(--text-faint);margin-left:4px">(Venda #${l.venda_id})</span>` : ''}
        </td>
        <td>${l.categoria_nome || '—'}</td>
        <td>
          <span class="badge ${l.tipo === 'receita' ? 'badge-green' : 'badge-red'}">
            ${l.tipo === 'receita' ? '⬆ Receita' : '⬇ Despesa'}
          </span>
        </td>
        <td>
          <strong class="${l.tipo === 'receita' ? 'saldo-positivo' : 'saldo-negativo'}">
            ${l.tipo === 'receita' ? '+' : '-'} ${Utils.moeda(l.valor)}
          </strong>
        </td>
        <td>
          <span class="badge ${l.status === 'pago' ? 'badge-green' : 'badge-yellow'}">
            ${l.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
          </span>
        </td>
        <td>
          <div class="action-btns">
            ${l.status === 'pendente' ? `<button class="btn btn-ghost btn-sm" title="Marcar como pago" onclick="PageFinanceiro.marcarPago(${l.id})">✅</button>` : ''}
            ${!l.venda_id ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" title="Excluir" onclick="PageFinanceiro.excluir(${l.id})">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function abrirFormulario() {
    if (!_categorias.length) {
      try { _categorias = await API.financeiro.categorias(); } catch(e) {}
    }
    Modal.open('+ Novo Lançamento', `
      <form id="form-lancamento">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo *</label>
            <select class="form-control" id="lanc-tipo">
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-control" id="lanc-categoria">
              <option value="">— Sem categoria —</option>
              ${_categorias.map(c => `<option value="${c.id}">${c.nome} (${c.tipo})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição *</label>
          <input class="form-control" id="lanc-descricao" type="text" required placeholder="Ex: Pagamento aluguel maio" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valor (R$) *</label>
            <input class="form-control" id="lanc-valor" type="number" min="0.01" step="0.01" required placeholder="0,00" />
          </div>
          <div class="form-group">
            <label class="form-label">Vencimento</label>
            <input class="form-control" id="lanc-vencimento" type="date" value="${Utils.hoje()}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-control" id="lanc-obs" placeholder="Opcional"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    document.getElementById('form-lancamento').addEventListener('submit', async e => {
      e.preventDefault();
      const dados = {
        tipo: document.getElementById('lanc-tipo').value,
        categoria_id: document.getElementById('lanc-categoria').value || null,
        descricao: document.getElementById('lanc-descricao').value,
        valor: parseFloat(document.getElementById('lanc-valor').value),
        vencimento: document.getElementById('lanc-vencimento').value,
        observacoes: document.getElementById('lanc-obs').value,
      };
      try {
        await API.financeiro.criar(dados);
        toast('Lançamento criado!', 'success');
        Modal.close();
        await Promise.all([carregarSaldo(), carregar()]);
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  async function marcarPago(id) {
    try {
      await API.financeiro.pagar(id);
      toast('Marcado como pago!', 'success');
      await Promise.all([carregarSaldo(), carregar()]);
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  async function excluir(id) {
    const ok = await Modal.confirm(
      'Deseja excluir este lançamento financeiro?<br><small style="color:var(--text-muted)">Esta ação não pode ser desfeita.</small>',
      { titulo: 'Excluir Lançamento', textoBotaoOk: '🗑️ Excluir', icone: '💰' }
    );
    if (!ok) return;
    try {
      await API.financeiro.excluir(id);
      toast('Lançamento excluído.', 'success');
      await Promise.all([carregarSaldo(), carregar()]);
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  return { render, marcarPago, excluir };
})();
