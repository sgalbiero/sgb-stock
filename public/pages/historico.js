const PageHistorico = (() => {
  let _resultado = null;
  let _filtros = {
    q: '',
    entidade: '',
    acao: '',
    usuario_id: '',
    data_inicial: '',
    data_final: '',
    page: 1,
    pageSize: 20,
  };

  function rotuloDetalhe(chave) {
    return chave
      .replace(/_/g, ' ')
      .replace(/\b\w/g, letra => letra.toUpperCase());
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🕘 Histórico</h1>
          <p class="page-subtitle">Auditagem de interações por usuário com pesquisa e filtros.</p>
        </div>
        <button class="btn btn-outline" id="historico-exportar">Exportar CSV</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <form id="form-filtros-historico" class="grid grid-4">
          <div class="form-group">
            <label class="form-label">Pesquisa</label>
            <input class="form-control" id="historico-q" type="text" placeholder="Venda, cliente, cancelamento..." value="${_filtros.q}" />
          </div>
          <div class="form-group">
            <label class="form-label">Entidade</label>
            <select class="form-control" id="historico-entidade"><option value="">Todas</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Ação</label>
            <select class="form-control" id="historico-acao"><option value="">Todas</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Usuário</label>
            <select class="form-control" id="historico-usuario"><option value="">Todos</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Data inicial</label>
            <input class="form-control" id="historico-data-inicial" type="date" value="${_filtros.data_inicial}" />
          </div>
          <div class="form-group">
            <label class="form-label">Data final</label>
            <input class="form-control" id="historico-data-final" type="date" value="${_filtros.data_final}" />
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn btn-primary" type="submit">Filtrar</button>
            <button class="btn btn-outline" type="button" id="historico-limpar">Limpar</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div id="historico-resumo" style="margin-bottom:12px;color:var(--text-muted)"></div>
        <div class="table-wrapper" id="historico-tabela"></div>
        <div id="historico-paginacao" style="margin-top:16px"></div>
      </div>
    `;

    await carregar();
    preencherFacetas();
    renderTabela();
    bindEventos(container);
  }

  async function carregar() {
    _resultado = await API.historico.listar(_filtros);
  }

  function preencherSelect(elementId, itens, valueKey, labelFn, selecionado) {
    const select = document.getElementById(elementId);
    if (!select) return;

    const padrao = select.options[0] ? select.options[0].outerHTML : '';
    const options = [padrao];
    for (const item of itens) {
      const value = valueKey ? item[valueKey] : item;
      const label = labelFn(item);
      const selected = String(value) === String(selecionado) ? 'selected' : '';
      options.push(`<option value="${value}" ${selected}>${label}</option>`);
    }
    select.innerHTML = options.join('');
  }

  function preencherFacetas() {
    preencherSelect('historico-entidade', _resultado.facetas.entidades || [], 'valor', item => item.label, _filtros.entidade);
    preencherSelect('historico-acao', _resultado.facetas.acoes || [], 'valor', item => item.label, _filtros.acao);
    preencherSelect('historico-usuario', _resultado.facetas.usuarios || [], 'id', item => `${item.nome} (${item.login})`, _filtros.usuario_id);
  }

  function formatarDetalhes(detalhes) {
    if (!detalhes || typeof detalhes !== 'object') return 'Sem detalhes adicionais';
    return Object.entries(detalhes)
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
      .map(([chave, valor]) => `<span class="badge">${rotuloDetalhe(chave)}: ${valor}</span>`)
      .join(' ');
  }

  function renderTabela() {
    const resumo = document.getElementById('historico-resumo');
    const tabela = document.getElementById('historico-tabela');
    const paginacao = document.getElementById('historico-paginacao');

    resumo.textContent = `${_resultado.paginacao.totalItens} evento(s) encontrado(s)`;

    if (!_resultado.itens.length) {
      tabela.innerHTML = `
        <div class="empty-state" style="padding:24px 0">
          <div class="empty-icon">🗂️</div>
          <p>Nenhum evento encontrado para os filtros aplicados.</p>
        </div>
      `;
      paginacao.innerHTML = '';
      return;
    }

    tabela.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Usuário</th>
            <th>Ação</th>
            <th>Entidade</th>
            <th>Descrição</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${_resultado.itens.map(item => `
            <tr>
              <td>${Utils.dataHora(item.criado_em)}</td>
              <td>
                <strong>${item.usuario_nome || 'Sistema'}</strong><br>
                <small style="color:var(--text-muted)">${item.usuario_login || '-'}</small>
              </td>
              <td><span class="badge">${item.acao_label || item.acao}</span></td>
              <td>${item.entidade_label || item.entidade}${item.entidade_id ? ` #${item.entidade_id}` : ''}</td>
              <td>${item.descricao}</td>
              <td>${formatarDetalhes(item.detalhes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    paginacao.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="color:var(--text-muted)">Página ${_resultado.paginacao.pagina} de ${_resultado.paginacao.totalPaginas}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" id="historico-prev" ${_resultado.paginacao.temAnterior ? '' : 'disabled'}>Anterior</button>
          <button class="btn btn-outline" id="historico-next" ${_resultado.paginacao.temProxima ? '' : 'disabled'}>Próxima</button>
        </div>
      </div>
    `;

    document.getElementById('historico-prev')?.addEventListener('click', async () => {
      _filtros.page -= 1;
      await recarregar();
    });
    document.getElementById('historico-next')?.addEventListener('click', async () => {
      _filtros.page += 1;
      await recarregar();
    });
  }

  function bindEventos(container) {
    document.getElementById('form-filtros-historico').addEventListener('submit', async event => {
      event.preventDefault();
      _filtros = {
        ..._filtros,
        q: document.getElementById('historico-q').value.trim(),
        entidade: document.getElementById('historico-entidade').value,
        acao: document.getElementById('historico-acao').value,
        usuario_id: document.getElementById('historico-usuario').value,
        data_inicial: document.getElementById('historico-data-inicial').value,
        data_final: document.getElementById('historico-data-final').value,
        page: 1,
      };
      await recarregar();
    });

    document.getElementById('historico-exportar').addEventListener('click', () => {
      const params = { ..._filtros };
      delete params.page;
      delete params.pageSize;
      window.open(API.historico.exportarUrl(params), '_blank');
    });

    document.getElementById('historico-limpar').addEventListener('click', async () => {
      _filtros = { q: '', entidade: '', acao: '', usuario_id: '', data_inicial: '', data_final: '', page: 1, pageSize: 20 };
      await render(container);
    });
  }

  async function recarregar() {
    try {
      await carregar();
      preencherFacetas();
      renderTabela();
    } catch (error) {
      toast('Erro ao carregar histórico: ' + error.message, 'error');
    }
  }

  return { render };
})();