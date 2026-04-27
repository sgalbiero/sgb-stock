/* financeiro.js — Painel financeiro, lançamentos e fluxo de caixa */

const PageFinanceiro = (() => {

  let _lancamentos = [];
  let _categorias = [];
  let _despesasFixas = [];

  function _hoje() {
    return Utils.hoje();
  }

  function _periodoAtual() {
    return {
      inicio: document.getElementById('fluxo-inicio')?.value || _hoje(),
      fim: document.getElementById('fluxo-fim')?.value || _hoje(),
    };
  }

  function _agrupamentoAtual() {
    return document.getElementById('fluxo-agrupamento')?.value || 'diario';
  }

  function _percentual(valor) {
    return `${Number(valor || 0).toFixed(1).replace('.', ',')}%`;
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">💰 Financeiro</h1>
          <p class="page-subtitle">Controle de caixa, receitas, despesas e lucratividade</p>
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
            <input class="form-control" id="fluxo-inicio" type="date" value="${_hoje()}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Até</label>
            <input class="form-control" id="fluxo-fim" type="date" value="${_hoje()}" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Visualização</label>
            <select class="form-control" id="fluxo-agrupamento">
              <option value="diario">Diária</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          <button class="btn btn-outline" id="btn-fluxo">Atualizar Período</button>
        </div>
        <div id="fin-fluxo"></div>
        <div id="fin-grafico-periodo" style="margin-top:18px"></div>
      </div>

      <div class="card">
        <div class="card-title">🧮 Indicadores de Lucratividade</div>
        <div id="fin-indicadores" class="stats-grid" style="grid-template-columns: repeat(5, minmax(160px, 1fr))">
          <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
          <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
          <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
          <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
          <div class="stat-card"><div class="spinner" style="margin:auto"></div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏷️ Desempenho de Produtos</div>
        <div id="fin-desempenho-produtos"><div class="spinner" style="margin:auto;display:block"></div></div>
      </div>

      <div class="card">
        <div class="page-header" style="margin-bottom:12px">
          <div>
            <div class="card-title" style="margin-bottom:4px">📌 Despesas Fixas</div>
            <div class="page-subtitle">Despesas recorrentes semanais, mensais ou anuais com geração automática de vencimentos.</div>
          </div>
          <button class="btn btn-outline" id="btn-nova-despesa-fixa">+ Nova Despesa Fixa</button>
        </div>
        <div id="fin-despesas-fixas"><div class="spinner" style="margin:auto;display:block"></div></div>
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
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tabela-lancamentos"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-lancamento').addEventListener('click', abrirFormulario);
    document.getElementById('btn-nova-despesa-fixa').addEventListener('click', () => abrirFormularioDespesaFixa());
    document.getElementById('btn-fluxo').addEventListener('click', atualizarResumoFinanceiro);
    document.getElementById('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('fluxo-agrupamento').addEventListener('change', carregarGraficoPeriodo);

    await Promise.all([atualizarResumoFinanceiro(), carregar(), carregarDespesasFixas()]);
    _categorias = await API.financeiro.categorias();
  }

  async function atualizarResumoFinanceiro() {
    await Promise.all([
      carregarSaldo(),
      carregarFluxo(),
      carregarGraficoPeriodo(),
      carregarIndicadores(),
      carregarDesempenhoProdutos()
    ]);
  }

  async function carregarSaldo() {
    try {
      const s = await API.financeiro.saldo(_periodoAtual());
      document.getElementById('fin-saldo-card').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Receitas Pagas no Período</div>
          <div class="stat-value green">${Utils.moeda(s.receitas)}</div>
          <div class="stat-icon">📈</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Despesas Pagas no Período</div>
          <div class="stat-value red">${Utils.moeda(s.despesas)}</div>
          <div class="stat-icon">📉</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Saldo do Período</div>
          <div class="stat-value ${s.saldo >= 0 ? 'green' : 'red'}">${Utils.moeda(s.saldo)}</div>
          <div class="stat-icon">${s.saldo >= 0 ? '💰' : '⚠️'}</div>
        </div>
      `;
    } catch(e) {
      document.getElementById('fin-saldo-card').innerHTML = `<div class="alert alert-danger">Erro ao carregar saldo.</div>`;
    }
  }

  async function carregarFluxo() {
    const { inicio, fim } = _periodoAtual();
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

  async function carregarIndicadores() {
    const { inicio, fim } = _periodoAtual();
    const el = document.getElementById('fin-indicadores');

    try {
      const indicadores = await API.financeiro.indicadores({ inicio, fim });
      el.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Receita Líquida</div>
          <div class="stat-value green">${Utils.moeda(indicadores.receita_liquida)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lucro Bruto</div>
          <div class="stat-value ${indicadores.lucro_bruto >= 0 ? 'green' : 'red'}">${Utils.moeda(indicadores.lucro_bruto)}</div>
          <div class="stat-detail">Margem: ${_percentual(indicadores.margem_bruta)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lucro Líquido</div>
          <div class="stat-value ${indicadores.lucro_liquido >= 0 ? 'green' : 'red'}">${Utils.moeda(indicadores.lucro_liquido)}</div>
          <div class="stat-detail">Margem: ${_percentual(indicadores.margem_liquida)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ticket Médio</div>
          <div class="stat-value">${Utils.moeda(indicadores.ticket_medio)}</div>
          <div class="stat-detail">${indicadores.total_vendas} venda(s) paga(s)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Custo dos Produtos</div>
          <div class="stat-value">${Utils.moeda(indicadores.custo_produtos)}</div>
          <div class="stat-detail">Despesas: ${Utils.moeda(indicadores.despesas)}</div>
        </div>
      `;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-danger">Erro ao carregar indicadores.</div>`;
    }
  }

  function _normalizarPontosSerie(pontos) {
    const valores = pontos.flatMap(ponto => [ponto.receitas, ponto.despesas, ponto.lucro]).map(Number);
    const maior = Math.max(...valores, 0);
    return maior > 0 ? maior : 1;
  }

  function _criarPolyline(pontos, chave, largura, altura, padding, maxValor) {
    if (pontos.length === 1) {
      const x = largura / 2;
      const y = altura - padding - ((Number(pontos[0][chave]) || 0) / maxValor) * (altura - padding * 2);
      return `${x},${y} ${x},${y}`;
    }

    return pontos.map((ponto, indice) => {
      const x = padding + (indice / (pontos.length - 1)) * (largura - padding * 2);
      const y = altura - padding - ((Number(ponto[chave]) || 0) / maxValor) * (altura - padding * 2);
      return `${x},${y}`;
    }).join(' ');
  }

  async function carregarGraficoPeriodo() {
    const { inicio, fim } = _periodoAtual();
    const agrupamento = _agrupamentoAtual();
    const el = document.getElementById('fin-grafico-periodo');

    try {
      const resposta = await API.financeiro.seriePeriodo({ inicio, fim, agrupamento });
      const pontos = resposta.pontos || [];

      if (!pontos.length) {
        el.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">📉</div><p>Sem dados para montar o gráfico.</p></div>`;
        return;
      }

      const largura = 860;
      const altura = 260;
      const padding = 24;
      const maxValor = _normalizarPontosSerie(pontos);
      const receitasPoints = _criarPolyline(pontos, 'receitas', largura, altura, padding, maxValor);
      const despesasPoints = _criarPolyline(pontos, 'despesas', largura, altura, padding, maxValor);
      const lucroPoints = _criarPolyline(pontos, 'lucro', largura, altura, padding, maxValor);
      const marcacoes = [0.25, 0.5, 0.75, 1].map(fator => ({
        y: altura - padding - fator * (altura - padding * 2),
        valor: maxValor * fator,
      }));

      el.innerHTML = `
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-legend">
              <span class="chart-legend-item"><span class="chart-dot receitas"></span>Receitas</span>
              <span class="chart-legend-item"><span class="chart-dot despesas"></span>Despesas</span>
              <span class="chart-legend-item"><span class="chart-dot lucro"></span>Lucro</span>
            </div>
            <div class="chart-caption">Agrupamento ${agrupamento === 'diario' ? 'diário' : agrupamento === 'semanal' ? 'semanal' : 'mensal'}</div>
          </div>
          <div class="chart-wrap">
            <svg class="chart-svg" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de receitas, despesas e lucro por período">
              ${marcacoes.map(item => `
                <g>
                  <line x1="${padding}" y1="${item.y}" x2="${largura - padding}" y2="${item.y}" class="chart-grid-line"></line>
                  <text x="0" y="${item.y + 4}" class="chart-axis-label">${Utils.moeda(item.valor)}</text>
                </g>
              `).join('')}
              <polyline points="${receitasPoints}" class="chart-line receitas"></polyline>
              <polyline points="${despesasPoints}" class="chart-line despesas"></polyline>
              <polyline points="${lucroPoints}" class="chart-line lucro"></polyline>
              ${pontos.map((ponto, indice) => {
                const x = pontos.length === 1 ? largura / 2 : padding + (indice / (pontos.length - 1)) * (largura - padding * 2);
                const yReceita = altura - padding - ((Number(ponto.receitas) || 0) / maxValor) * (altura - padding * 2);
                const yDespesa = altura - padding - ((Number(ponto.despesas) || 0) / maxValor) * (altura - padding * 2);
                const yLucro = altura - padding - ((Number(ponto.lucro) || 0) / maxValor) * (altura - padding * 2);
                return `
                  <g>
                    <rect x="${x - 14}" y="${padding}" width="28" height="${altura - padding * 2}" fill="transparent" data-chart-index="${indice}"></rect>
                    <circle cx="${x}" cy="${yReceita}" r="3.5" class="chart-point receitas"></circle>
                    <circle cx="${x}" cy="${yDespesa}" r="3.5" class="chart-point despesas"></circle>
                    <circle cx="${x}" cy="${yLucro}" r="3.5" class="chart-point lucro"></circle>
                  </g>
                `;
              }).join('')}
            </svg>
            <div class="chart-tooltip hidden" id="fin-chart-tooltip"></div>
          </div>
          <div class="chart-labels">
            ${pontos.map(ponto => `<span>${ponto.label || Utils.data(ponto.data)}</span>`).join('')}
          </div>
        </div>
      `;

      const tooltip = document.getElementById('fin-chart-tooltip');
      const wrap = el.querySelector('.chart-wrap');
      el.querySelectorAll('[data-chart-index]').forEach(alvo => {
        alvo.addEventListener('mouseenter', event => mostrarTooltip(event, Number(alvo.dataset.chartIndex), pontos, tooltip, wrap));
        alvo.addEventListener('mousemove', event => mostrarTooltip(event, Number(alvo.dataset.chartIndex), pontos, tooltip, wrap));
        alvo.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
      });
    } catch(e) {
      el.innerHTML = `<div class="alert alert-danger">Erro ao carregar gráfico do período.</div>`;
    }
  }

  function mostrarTooltip(event, indice, pontos, tooltip, wrap) {
    const ponto = pontos[indice];
    if (!ponto || !tooltip || !wrap) return;

    tooltip.innerHTML = `
      <strong>${ponto.label || Utils.data(ponto.data)}</strong>
      <span>Receitas: ${Utils.moeda(ponto.receitas)}</span>
      <span>Despesas: ${Utils.moeda(ponto.despesas)}</span>
      <span>Lucro: ${Utils.moeda(ponto.lucro)}</span>
    `;
    tooltip.classList.remove('hidden');

    const wrapRect = wrap.getBoundingClientRect();
    const offsetX = event.clientX - wrapRect.left;
    const offsetY = event.clientY - wrapRect.top;

    tooltip.style.left = `${Math.min(Math.max(offsetX + 12, 12), wrapRect.width - 180)}px`;
    tooltip.style.top = `${Math.max(offsetY - 12, 8)}px`;
  }

  async function carregarDesempenhoProdutos() {
    const { inicio, fim } = _periodoAtual();
    const el = document.getElementById('fin-desempenho-produtos');

    try {
      const resposta = await API.financeiro.desempenhoProdutos({ inicio, fim, limite: 5 });
      const produtos = resposta.produtos || [];

      if (!produtos.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>Nenhuma venda paga encontrada para o período selecionado.</p></div>`;
        return;
      }

      el.innerHTML = `
        <div style="margin-bottom:12px;color:var(--text-muted);font-size:13px">Top produtos por receita no período selecionado.</div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Produto</th><th>Qtd.</th><th>Receita</th><th>Lucro Bruto</th><th>Margem Bruta</th></tr></thead>
            <tbody>
              ${produtos.map(produto => `
                <tr>
                  <td><strong>${produto.produto_nome}</strong></td>
                  <td>${produto.quantidade_vendida}</td>
                  <td>${Utils.moeda(produto.receita)}</td>
                  <td class="${produto.lucro_bruto >= 0 ? 'saldo-positivo' : 'saldo-negativo'}">${Utils.moeda(produto.lucro_bruto)}</td>
                  <td>${_percentual(produto.margem_bruta)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-danger">Erro ao carregar desempenho de produtos.</div>`;
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

  async function carregarDespesasFixas() {
    try {
      _despesasFixas = await API.financeiro.despesasFixas();
      renderDespesasFixas();
    } catch (error) {
      document.getElementById('fin-despesas-fixas').innerHTML = `<div class="alert alert-danger">Erro ao carregar despesas fixas.</div>`;
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
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💰</div><p>Nenhum lançamento encontrado.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(l => `
      <tr>
        <td style="white-space:nowrap">${Utils.data(l.criado_em)}</td>
        <td>
          <strong>${l.descricao}</strong>
          ${l.venda_id ? `<span style="font-size:11px;color:var(--text-faint);margin-left:4px">(Venda #${l.venda_id})</span>` : ''}
          ${l.despesa_fixa_id ? `<span class="badge badge-purple" style="margin-left:6px">Fixa</span>` : ''}
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
        <td>${l.vencimento ? Utils.data(l.vencimento) : '—'}</td>
        <td>
          <span class="badge ${l.status === 'pago' ? 'badge-green' : 'badge-yellow'}">
            ${l.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
          </span>
        </td>
        <td>
          <div class="action-btns">
            ${!l.venda_id && !l.despesa_fixa_id ? `<button class="btn btn-ghost btn-sm" title="Editar" onclick="PageFinanceiro.editarLancamento(${l.id})">✏️</button>` : ''}
            ${l.status === 'pendente' ? `<button class="btn btn-ghost btn-sm" title="Marcar como pago" onclick="PageFinanceiro.marcarPago(${l.id})">✅</button>` : ''}
            ${!l.venda_id ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" title="Excluir" onclick="PageFinanceiro.excluir(${l.id})">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderDespesasFixas() {
    const el = document.getElementById('fin-despesas-fixas');
    if (!_despesasFixas.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📌</div><p>Nenhuma despesa fixa cadastrada.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Dia</th><th>Próximo vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${_despesasFixas.map(item => `
              <tr>
                <td><strong>${item.descricao}</strong></td>
                <td>${item.categoria_nome || '—'}</td>
                <td class="saldo-negativo">${Utils.moeda(item.valor)}</td>
                <td>${rotuloRecorrencia(item)}</td>
                <td>${item.proximo_vencimento ? Utils.data(item.proximo_vencimento) : '—'}</td>
                <td>
                  <span class="badge ${item.ativa ? item.status_atual === 'pago' ? 'badge-green' : 'badge-yellow' : 'badge-red'}">
                    ${item.ativa ? (item.status_atual === 'pago' ? 'Pago neste mês' : 'Ativa') : 'Inativa'}
                  </span>
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-ghost btn-sm" onclick="PageFinanceiro.editarDespesaFixa(${item.id})">✏️</button>
                    ${item.ativa ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageFinanceiro.desativarDespesaFixa(${item.id})">🗑️</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function abrirFormulario() {
    return abrirFormularioLancamento();
  }

  async function abrirFormularioLancamento(item = null) {
    if (!_categorias.length) {
      try { _categorias = await API.financeiro.categorias(); } catch(e) {}
    }

    Modal.open(item ? 'Editar Lançamento' : '+ Novo Lançamento', `
      <form id="form-lancamento">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo *</label>
            <select class="form-control" id="lanc-tipo">
              <option value="receita" ${item?.tipo === 'receita' ? 'selected' : ''}>Receita</option>
              <option value="despesa" ${!item || item?.tipo === 'despesa' ? 'selected' : ''}>Despesa</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-control" id="lanc-categoria">
              <option value="">— Sem categoria —</option>
              ${_categorias.map(c => `<option value="${c.id}" ${Number(item?.categoria_id) === Number(c.id) ? 'selected' : ''}>${c.nome} (${c.tipo})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição *</label>
          <input class="form-control" id="lanc-descricao" type="text" required placeholder="Ex: Pagamento aluguel maio" value="${item?.descricao || ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valor (R$) *</label>
            <input class="form-control" id="lanc-valor" type="number" min="0.01" step="0.01" required placeholder="0,00" value="${item?.valor || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Vencimento</label>
            <input class="form-control" id="lanc-vencimento" type="date" value="${item?.vencimento || Utils.hoje()}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-control" id="lanc-obs" placeholder="Opcional">${item?.observacoes || ''}</textarea>
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
        if (item) {
          await API.financeiro.atualizar(item.id, dados);
          toast('Lançamento atualizado!', 'success');
        } else {
          await API.financeiro.criar(dados);
          toast('Lançamento criado!', 'success');
        }
        Modal.close();
        await Promise.all([atualizarResumoFinanceiro(), carregar()]);
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  function editarLancamento(id) {
    const item = _lancamentos.find(lancamento => lancamento.id === id);
    if (!item || item.venda_id || item.despesa_fixa_id) return;
    abrirFormularioLancamento(item);
  }

  async function abrirFormularioDespesaFixa(item = null) {
    if (!_categorias.length) {
      try { _categorias = await API.financeiro.categorias(); } catch (error) {}
    }

    Modal.open(item ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa', `
      <form id="form-despesa-fixa">
        <div class="form-group">
          <label class="form-label">Descrição *</label>
          <input class="form-control" id="fixa-descricao" type="text" required value="${item?.descricao || ''}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Valor (R$) *</label>
            <input class="form-control" id="fixa-valor" type="number" min="0.01" step="0.01" required value="${item?.valor || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Primeiro vencimento *</label>
            <input class="form-control" id="fixa-data-base" type="date" required value="${item?.data_base || item?.proximo_vencimento || Utils.hoje()}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Periodicidade *</label>
            <select class="form-control" id="fixa-periodicidade">
              <option value="semanal" ${item?.periodicidade === 'semanal' ? 'selected' : ''}>Semanal</option>
              <option value="mensal" ${!item || item?.periodicidade === 'mensal' ? 'selected' : ''}>Mensal</option>
              <option value="anual" ${item?.periodicidade === 'anual' ? 'selected' : ''}>Anual</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Repetir a cada</label>
            <input class="form-control" id="fixa-intervalo" type="number" min="1" max="12" value="${item?.intervalo_repeticao || 1}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-control" id="fixa-categoria">
            <option value="">— Sem categoria —</option>
            ${_categorias.filter(c => c.tipo === 'despesa').map(c => `<option value="${c.id}" ${Number(item?.categoria_id) === Number(c.id) ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea class="form-control" id="fixa-obs">${item?.observacoes || ''}</textarea>
        </div>
        ${item ? `
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="fixa-ativa" ${item.ativa ? 'checked' : ''} /> Manter despesa fixa ativa</label>
          </div>
        ` : ''}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    document.getElementById('form-despesa-fixa').addEventListener('submit', async event => {
      event.preventDefault();
      const dados = {
        descricao: document.getElementById('fixa-descricao').value.trim(),
        valor: parseFloat(document.getElementById('fixa-valor').value),
        data_base: document.getElementById('fixa-data-base').value,
        dia_vencimento: parseInt(document.getElementById('fixa-data-base').value.slice(8, 10), 10),
        periodicidade: document.getElementById('fixa-periodicidade').value,
        intervalo_repeticao: parseInt(document.getElementById('fixa-intervalo').value, 10) || 1,
        categoria_id: document.getElementById('fixa-categoria').value || null,
        observacoes: document.getElementById('fixa-obs').value.trim(),
        ativa: item ? document.getElementById('fixa-ativa')?.checked : true,
      };

      try {
        if (item) {
          await API.financeiro.atualizarDespesaFixa(item.id, dados);
          toast('Despesa fixa atualizada.', 'success');
        } else {
          await API.financeiro.criarDespesaFixa(dados);
          toast('Despesa fixa criada.', 'success');
        }
        Modal.close();
        await Promise.all([carregarDespesasFixas(), carregar(), atualizarResumoFinanceiro()]);
      } catch (error) {
        toast('Erro: ' + error.message, 'error');
      }
    });
  }

  function editarDespesaFixa(id) {
    const item = _despesasFixas.find(despesa => despesa.id === id);
    if (!item) return;
    abrirFormularioDespesaFixa(item);
  }

  async function desativarDespesaFixa(id) {
    const ok = await Modal.confirm(
      'Deseja desativar esta despesa fixa?<br><small style="color:var(--text-muted)">Os lançamentos já gerados continuarão disponíveis para pagamento.</small>',
      { titulo: 'Desativar Despesa Fixa', textoBotaoOk: '🗑️ Desativar', icone: '📌' }
    );
    if (!ok) return;

    try {
      await API.financeiro.excluirDespesaFixa(id);
      toast('Despesa fixa desativada.', 'success');
      await Promise.all([carregarDespesasFixas(), carregar(), atualizarResumoFinanceiro()]);
    } catch (error) {
      toast('Erro: ' + error.message, 'error');
    }
  }

  function rotuloRecorrencia(item) {
    const periodicidade = item.periodicidade || 'mensal';
    const intervalo = Number(item.intervalo_repeticao || 1);
    if (periodicidade === 'semanal') return intervalo > 1 ? `A cada ${intervalo} semanas` : 'Semanal';
    if (periodicidade === 'anual') return intervalo > 1 ? `A cada ${intervalo} anos` : 'Anual';
    return intervalo > 1 ? `A cada ${intervalo} meses` : 'Mensal';
  }

  async function marcarPago(id) {
    try {
      await API.financeiro.pagar(id);
      toast('Marcado como pago!', 'success');
      await Promise.all([atualizarResumoFinanceiro(), carregar()]);
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
      await Promise.all([atualizarResumoFinanceiro(), carregar()]);
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  return { render, marcarPago, excluir, editarDespesaFixa, desativarDespesaFixa, editarLancamento };
})();
