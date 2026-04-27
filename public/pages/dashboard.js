/* dashboard.js — Página inicial com KPIs, últimas vendas e alertas */

const PageDashboard = (() => {

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📊 Dashboard</h1>
          <p class="page-subtitle">Visão geral da loja hoje</p>
        </div>
        <span id="dash-datetime" style="font-size:13px;color:var(--text-muted)"></span>
      </div>

      <div class="stats-grid" id="dash-stats">
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap">
        <div class="card">
          <div class="card-title">🛒 Últimas Vendas</div>
          <div id="dash-vendas"><div class="spinner" style="margin:auto;display:block"></div></div>
        </div>
        <div class="card">
          <div class="card-title">🚨 Estoque Zerado</div>
          <div id="dash-alertas"><div class="spinner" style="margin:auto;display:block"></div></div>
        </div>
      </div>
    `;

    // Relógio
    const dtEl = document.getElementById('dash-datetime');
    function tick() { dtEl.textContent = new Date().toLocaleString('pt-BR'); }
    tick(); setInterval(tick, 1000);

    await Promise.all([carregarStats(), carregarUltimasVendas(), carregarAlertas()]);
  }

  async function carregarStats() {
    try {
      const [saldo, vendas] = await Promise.all([
        API.financeiro.saldo(),
        API.vendas.listar()
      ]);

      const hoje = Utils.hoje();
      const vendasHoje = vendas.filter(v => v.criado_em && v.criado_em.startsWith(hoje) && v.status === 'concluida');
      const totalHoje = vendasHoje.reduce((s, v) => s + v.total, 0);

      document.getElementById('dash-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Vendas Hoje (valor)</div>
          <div class="stat-value green">${Utils.moeda(totalHoje)}</div>
          <div class="stat-icon">💵</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Vendas Hoje (qtd)</div>
          <div class="stat-value purple">${vendasHoje.length}</div>
          <div class="stat-icon">🛒</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Saldo Financeiro</div>
          <div class="stat-value ${saldo.saldo >= 0 ? 'green' : 'red'}">${Utils.moeda(saldo.saldo)}</div>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Despesas Pagas</div>
          <div class="stat-value red">${Utils.moeda(saldo.despesas)}</div>
          <div class="stat-icon">📉</div>
        </div>
      `;
    } catch(e) {
      document.getElementById('dash-stats').innerHTML = `<div class="alert alert-danger">Erro ao carregar estatísticas.</div>`;
    }
  }

  async function carregarUltimasVendas() {
    try {
      const vendas = await API.vendas.listar();
      const ultimas = vendas.slice(0, 5);
      const el = document.getElementById('dash-vendas');

      if (!ultimas.length) {
        el.innerHTML = `<div class="empty-state" style="padding:30px 0"><div class="empty-icon">🛒</div><p>Nenhuma venda registrada.</p></div>`;
        return;
      }

      el.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${ultimas.map(v => `
                <tr style="cursor:pointer" onclick="Router.navigate('/vendas')">
                  <td><strong>#${v.id}</strong></td>
                  <td>${v.cliente_nome || '<em style="color:var(--text-faint)">Avulso</em>'}</td>
                  <td><strong>${Utils.moeda(v.total)}</strong></td>
                  <td>${Utils.formaPagamentoLabel(v.forma_pagamento)}</td>
                  <td><span class="badge ${v.status === 'concluida' ? 'badge-green' : 'badge-red'}">${v.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch(e) {
      document.getElementById('dash-vendas').innerHTML = `<p style="color:var(--text-muted)">Erro ao carregar.</p>`;
    }
  }

  async function carregarAlertas() {
    try {
      const produtos = await API.produtos.listar();
      const el = document.getElementById('dash-alertas');
      // Verificar quais produtos têm variações com estoque zero é complexo nesta chamada
      // Vamos buscar detalhes de cada produto para verificar
      // Para performance no MVP, exibiremos nota e link
      el.innerHTML = `
        <div style="padding:12px 0;color:var(--text-muted);font-size:13px">
          <p>Para ver variações com estoque zero, acesse</p>
          <a href="#/produtos" class="btn btn-outline btn-sm" style="margin-top:10px">📦 Ver Produtos</a>
        </div>
        <div style="margin-top:12px;padding:12px;background:var(--warning-light);border-radius:var(--radius-sm);color:#78350f;font-size:13px">
          ⚠️ Variações com estoque zerado são destacadas em <strong>vermelho</strong> na tela de Produtos.
        </div>
      `;
    } catch(e) {
      document.getElementById('dash-alertas').innerHTML = `<p style="color:var(--text-muted)">Erro ao carregar.</p>`;
    }
  }

  return { render };
})();
