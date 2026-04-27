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

      ${Auth.isAdmin() ? `
        <div class="card" style="margin-bottom:20px">
          <div class="card-title">📅 Contas Próximas do Vencimento</div>
          <div id="dash-contas-vencer"><div class="spinner" style="margin:auto;display:block"></div></div>
        </div>
      ` : ''}

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

    await Promise.all([carregarStats(), carregarUltimasVendas(), carregarAlertas(), carregarContasVencer()]);
  }

  async function carregarStats() {
    try {
      const vendas = await API.vendas.listar();
      const saldo = Auth.isAdmin() ? await API.financeiro.saldo() : null;

      const hoje = Utils.hoje();
      const vendasHoje = vendas.filter(v => v.criado_em && v.criado_em.startsWith(hoje) && v.status === 'concluida');
      const vendasPagasHoje = vendasHoje.filter(v => v.status_pagamento === 'pago');
      const vendasPendentesHoje = vendasHoje.filter(v => v.status_pagamento === 'aguardando_pagamento');
      const totalRecebidoHoje = vendasPagasHoje.reduce((s, v) => s + v.total, 0);
      const totalPendenteHoje = vendasPendentesHoje.reduce((s, v) => s + v.total, 0);
      const totalVendasHoje = vendasHoje.length;
      const ticketMedioHoje = totalVendasHoje ? vendasHoje.reduce((s, v) => s + v.total, 0) / totalVendasHoje : 0;

      document.getElementById('dash-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Recebido Hoje</div>
          <div class="stat-value green">${Utils.moeda(totalRecebidoHoje)}</div>
          <div class="stat-icon">💵</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Aguardando Pagamento</div>
          <div class="stat-value purple">${Utils.moeda(totalPendenteHoje)}</div>
          <div class="stat-icon">⏳</div>
        </div>
        ${Auth.isAdmin() ? `
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
        ` : `
          <div class="stat-card">
            <div class="stat-label">Vendas Concluídas Hoje</div>
            <div class="stat-value blue">${totalVendasHoje}</div>
            <div class="stat-icon">🛒</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Ticket Médio Hoje</div>
            <div class="stat-value blue">${Utils.moeda(ticketMedioHoje)}</div>
            <div class="stat-icon">🎯</div>
          </div>
        `}
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
              <th>#</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Situação</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${ultimas.map(v => `
                <tr style="cursor:pointer" onclick="Router.navigate('/vendas')">
                  <td><strong>#${v.id}</strong></td>
                  <td>${v.cliente_nome || '<em style="color:var(--text-faint)">Avulso</em>'}</td>
                  <td><strong>${Utils.moeda(v.total)}</strong></td>
                  <td>${Utils.formaPagamentoLabel(v.forma_pagamento)}</td>
                  <td><span class="badge ${v.status_pagamento === 'pago' ? 'badge-green' : 'badge-yellow'}">${v.status_pagamento === 'pago' ? 'Pago' : 'Aguardando'}</span></td>
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

  async function carregarContasVencer() {
    const el = document.getElementById('dash-contas-vencer');
    if (!el || !Auth.isAdmin()) return;

    try {
      const resposta = await API.financeiro.contasProximasVencer({ dias: 7 });
      const itens = resposta.itens || [];
      const resumo = resposta.resumo_atrasos || {};

      if (!itens.length) {
        el.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">✅</div><p>Nenhuma despesa pendente próxima do vencimento.</p></div>`;
        return;
      }

      el.innerHTML = `
        <div class="stats-grid" style="grid-template-columns:repeat(5,minmax(120px,1fr));margin-bottom:14px">
          <div class="stat-card"><div class="stat-label">Atrasadas 1-7 dias</div><div class="stat-value red">${resumo.atrasadas_1_7 || 0}</div></div>
          <div class="stat-card"><div class="stat-label">Atrasadas 8-30 dias</div><div class="stat-value red">${resumo.atrasadas_8_30 || 0}</div></div>
          <div class="stat-card"><div class="stat-label">Atrasadas +30 dias</div><div class="stat-value red">${resumo.atrasadas_mais_30 || 0}</div></div>
          <div class="stat-card"><div class="stat-label">Vencem em 1-3 dias</div><div class="stat-value purple">${resumo.vencem_1_3 || 0}</div></div>
          <div class="stat-card"><div class="stat-label">Vencem em 4-7 dias</div><div class="stat-value purple">${resumo.vencem_4_7 || 0}</div></div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              ${itens.map(item => `
                <tr>
                  <td><strong>${item.descricao}</strong></td>
                  <td>${item.categoria_nome || '—'}</td>
                  <td>${Utils.data(item.vencimento)}</td>
                  <td class="saldo-negativo">${Utils.moeda(item.valor)}</td>
                  <td>
                    <span class="badge ${item.urgencia === 'atrasado' ? 'badge-red' : item.urgencia === 'vence_hoje' ? 'badge-yellow' : 'badge-purple'}">
                      ${item.urgencia === 'atrasado' ? 'Atrasado' : item.urgencia === 'vence_hoje' ? 'Vence hoje' : `Em ${item.dias_restantes} dia(s)`}
                    </span>
                  </td>
                  <td><button class="btn btn-ghost btn-sm" onclick="PageDashboard.marcarContaPaga(${item.id})">✅ Pagar</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      el.innerHTML = `<p style="color:var(--text-muted)">Erro ao carregar contas próximas do vencimento.</p>`;
    }
  }

  async function marcarContaPaga(id) {
    try {
      await API.financeiro.pagar(id);
      toast('Conta marcada como paga.', 'success');
      await Promise.all([carregarStats(), carregarContasVencer()]);
    } catch (error) {
      toast('Erro: ' + error.message, 'error');
    }
  }

  return { render, marcarContaPaga };
})();
