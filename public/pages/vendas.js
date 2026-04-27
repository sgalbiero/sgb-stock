/* vendas.js — Nova venda, listagem e cancelamento */

const PageVendas = (() => {

  let _vendas = [];

  function badgeStatusVenda(status) {
    return status === 'concluida' ? 'badge-green' : 'badge-red';
  }

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
          <h1 class="page-title">🛒 Vendas</h1>
          <p class="page-subtitle">Registre e acompanhe vendas</p>
        </div>
        <button class="btn btn-primary" id="btn-nova-venda">+ Nova Venda</button>
      </div>

      <div class="toolbar">
        <input class="search-input" id="filtro-venda-data" type="date" value="${Utils.hoje()}" style="max-width:170px" />
        <select class="form-control" id="filtro-venda-pagamento" style="max-width:170px">
          <option value="">Todas as formas</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="pix">Pix</option>
          <option value="misto">Misto</option>
        </select>
        <select class="form-control" id="filtro-venda-status-pagamento" style="max-width:220px">
          <option value="">Todo pagamento</option>
          <option value="aguardando_pagamento">Aguardando pagamento</option>
          <option value="pago">Pago</option>
        </select>
        <button class="btn btn-outline" id="btn-limpar-filtros">Limpar</button>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Total</th><th>Forma</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tabela-vendas"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-nova-venda').addEventListener('click', abrirNovaVenda);
    document.getElementById('filtro-venda-data').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-venda-pagamento').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-venda-status-pagamento').addEventListener('change', aplicarFiltros);
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
      document.getElementById('filtro-venda-data').value = '';
      document.getElementById('filtro-venda-pagamento').value = '';
      document.getElementById('filtro-venda-status-pagamento').value = '';
      renderTabela(_vendas);
    });

    await carregar();
  }

  async function carregar() {
    try {
      _vendas = await API.vendas.listar();
      aplicarFiltros();
    } catch(e) {
      toast('Erro ao carregar vendas: ' + e.message, 'error');
    }
  }

  function aplicarFiltros() {
    const data = document.getElementById('filtro-venda-data')?.value;
    const pagto = document.getElementById('filtro-venda-pagamento')?.value;
    const statusPagamento = document.getElementById('filtro-venda-status-pagamento')?.value;
    let lista = [..._vendas];
    if (data) lista = lista.filter(v => v.criado_em && v.criado_em.startsWith(data));
    if (pagto) lista = lista.filter(v => v.forma_pagamento === pagto);
    if (statusPagamento) lista = lista.filter(v => v.status_pagamento === statusPagamento);
    renderTabela(lista);
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-vendas');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🛒</div><p>Nenhuma venda encontrada.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(v => `
      <tr>
        <td><strong>#${v.id}</strong></td>
        <td style="white-space:nowrap">${Utils.dataHora(v.criado_em)}</td>
        <td>${v.cliente_nome || '<em style="color:var(--text-faint)">Avulso</em>'}</td>
        <td><strong>${Utils.moeda(v.total)}</strong></td>
        <td>${Utils.formaPagamentoLabel(v.forma_pagamento)}</td>
        <td><span class="badge ${badgeStatusPagamento(v.status_pagamento)}">${labelStatusPagamento(v.status_pagamento)}</span></td>
        <td><span class="badge ${badgeStatusVenda(v.status)}">${v.status}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn-ghost btn-sm" onclick="PageVendas.verDetalhe(${v.id})" title="Ver detalhe">👁️</button>
            ${v.status === 'concluida' && v.status_pagamento !== 'pago' ? `<button class="btn btn-ghost btn-sm" onclick="PageVendas.marcarComoPaga(${v.id})" title="Marcar como paga">✅</button>` : ''}
            ${v.status === 'concluida' ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageVendas.cancelar(${v.id})" title="Cancelar">❌</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ========================
  // NOVA VENDA
  // ========================
  async function abrirNovaVenda() {
    const [clientes, produtos] = await Promise.all([API.clientes.listar(), API.produtos.listar()]);
    const carrinho = [];
    let produtoBuscado = null;

    const clienteOpcoes = [
      { value: '', label: '— Vender sem cadastro (avulso) —', searchText: 'cliente avulso vender sem cadastro avulso' },
      ...clientes.map(cliente => ({
        value: String(cliente.id),
        label: cliente.nome,
        searchText: `${cliente.nome} ${cliente.telefone || ''}`.toLowerCase()
      }))
    ];

    const produtoOpcoes = produtos.map(produto => ({
      value: String(produto.id),
      label: `${produto.nome} (${produto.sku})`,
      searchText: `${produto.nome} ${produto.sku}`.toLowerCase(),
      meta: {
        preco: produto.preco,
        custo: produto.custo,
      }
    }));

    Modal.open('🛒 Nova Venda', `
      <div>
        <!-- Cliente -->
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <div id="venda-cliente-combobox"></div>
        </div>

        <!-- Busca de produto -->
        <div class="form-group">
          <label class="form-label">Adicionar Produto</label>
          <div style="display:flex;gap:8px">
            <div id="venda-produto-combobox" style="flex:1"></div>
            <button type="button" class="btn btn-outline" id="btn-buscar-variacoes">Buscar</button>
          </div>
        </div>

        <div id="venda-variacoes-container" style="margin-bottom:14px"></div>

        <!-- Carrinho -->
        <div class="form-group">
          <label class="form-label">Itens da Venda</label>
          <div id="venda-carrinho"></div>
        </div>

        <!-- Desconto e Pagamento -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Desconto (R$)</label>
            <input class="form-control" id="venda-desconto" type="number" min="0" step="0.01" value="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Forma de Pagamento *</label>
            <select class="form-control" id="venda-pagamento">
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="misto">Misto</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Situação do Pagamento *</label>
          <select class="form-control" id="venda-status-pagamento">
            <option value="pago">Pago</option>
            <option value="aguardando_pagamento">Aguardando pagamento</option>
          </select>
        </div>

        <!-- Troco (apenas para dinheiro) -->
        <div id="venda-troco-area" style="display:none">
          <div class="form-group">
            <label class="form-label">Valor Recebido (R$)</label>
            <input class="form-control" id="venda-recebido" type="number" min="0" step="0.01" value="0" />
          </div>
          <div id="venda-troco-box"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Observações</label>
          <input class="form-control" id="venda-obs" type="text" placeholder="Opcional" />
        </div>

        <!-- Total -->
        <div class="cart-total-area" id="venda-totais">
          <div class="cart-total-row"><span>Subtotal:</span><span id="span-subtotal">R$ 0,00</span></div>
          <div class="cart-total-row"><span>Desconto:</span><span id="span-desconto">- R$ 0,00</span></div>
          <div class="cart-total-row grand"><span>TOTAL:</span><span id="span-total">R$ 0,00</span></div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="button" class="btn btn-success" id="btn-confirmar-venda">✅ Confirmar Venda</button>
        </div>
      </div>
    `);

    // Estender modal
    document.querySelector('.modal-box').style.maxWidth = '720px';

    function criarCombobox({ mountId, inputId, listId, hiddenId, placeholder, options, initialValue = '', fallbackValue = null }) {
      const mount = document.getElementById(mountId);
      mount.innerHTML = `
        <div style="position:relative">
          <div id="${inputId}-shell" style="position:relative;display:flex;align-items:center;width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);transition:border-color var(--transition), box-shadow var(--transition)">
            <input
              id="${inputId}"
              type="text"
              placeholder="${placeholder}"
              autocomplete="off"
              style="width:100%;border:0;background:transparent;color:var(--text);padding:9px 12px;font-size:13.5px;font-family:inherit;outline:none;cursor:pointer;caret-color:transparent"
            />
            <button type="button" id="${inputId}-toggle" aria-label="Abrir lista" style="border:0;background:transparent;color:var(--text-faint);padding:0 12px;align-self:stretch;cursor:pointer">▼</button>
          </div>
          <input id="${hiddenId}" type="hidden" />
          <div id="${listId}" style="position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:220px;overflow:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);display:none;z-index:30"></div>
        </div>
      `;

      const input = document.getElementById(inputId);
      const shell = document.getElementById(`${inputId}-shell`);
      const toggle = document.getElementById(`${inputId}-toggle`);
      const hidden = document.getElementById(hiddenId);
      const list = document.getElementById(listId);
      let filteredOptions = [...options];
      let selected = options.find(option => option.value === initialValue) || options[0] || null;
      let aberto = false;

      function atualizarVisual() {
        shell.style.borderColor = aberto ? 'var(--primary)' : 'var(--border)';
        shell.style.boxShadow = aberto ? '0 0 0 3px var(--primary-glow)' : 'none';
        shell.style.borderBottomLeftRadius = aberto ? '0' : 'var(--radius-sm)';
        shell.style.borderBottomRightRadius = aberto ? '0' : 'var(--radius-sm)';
        toggle.textContent = aberto ? '▲' : '▼';
        input.style.caretColor = aberto ? 'var(--text)' : 'transparent';
      }

      function abrirLista(mostrarTodas = true) {
        aberto = true;
        if (mostrarTodas) {
          filteredOptions = [...options];
        }
        list.style.display = 'block';
        atualizarVisual();
        renderList();
      }

      function fecharLista() {
        aberto = false;
        list.style.display = 'none';
        atualizarVisual();
      }

      function restaurarSelecao() {
        if (!hidden.value && fallbackValue !== null) {
          selected = options.find(option => option.value === fallbackValue) || null;
          if (selected) {
            hidden.value = selected.value;
            input.value = selected.label;
          } else {
            input.value = '';
          }
        } else if (!hidden.value) {
          selected = null;
          input.value = '';
        } else if (hidden.value) {
          selected = options.find(option => option.value === hidden.value) || selected;
          if (selected) input.value = selected.label;
        }
      }

      function renderList() {
        if (!filteredOptions.length) {
          list.innerHTML = `<div style="padding:10px 12px;color:var(--text-muted);font-size:13px">Nenhum resultado encontrado.</div>`;
          return;
        }

        list.innerHTML = filteredOptions.map(option => `
          <button
            type="button"
            data-combobox-value="${option.value}"
            style="width:100%;text-align:left;border:0;background:${selected?.value === option.value ? 'var(--bg-elevated)' : 'transparent'};padding:10px 12px;cursor:pointer;color:var(--text);border-bottom:1px solid var(--border);font:inherit"
          >${option.label}</button>
        `).join('');

        list.querySelectorAll('[data-combobox-value]').forEach(button => {
          button.addEventListener('click', () => {
            const option = options.find(item => item.value === button.dataset.comboboxValue);
            if (!option) return;
            selected = option;
            hidden.value = option.value;
            input.value = option.label;
            fecharLista();
            renderList();
          });
        });
      }

      function filtrarLista() {
        const termo = input.value.trim().toLowerCase();
        filteredOptions = options.filter(option => option.searchText.includes(termo) || option.label.toLowerCase().includes(termo));
        abrirLista(false);
        renderList();
      }

      if (selected) {
        hidden.value = selected.value;
        input.value = selected.label;
      }

      atualizarVisual();

      input.addEventListener('focus', () => {
        abrirLista(true);
        window.setTimeout(() => input.select(), 0);
      });

      input.addEventListener('click', () => {
        if (!aberto) {
          abrirLista(true);
          window.setTimeout(() => input.select(), 0);
        }
      });

      input.addEventListener('input', filtrarLista);

      toggle.addEventListener('mousedown', event => {
        event.preventDefault();
        if (aberto) {
          restaurarSelecao();
          fecharLista();
          input.blur();
          return;
        }
        input.focus();
        abrirLista(true);
        window.setTimeout(() => input.select(), 0);
      });

      input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          restaurarSelecao();
          fecharLista();
          input.blur();
        }

        if (event.key === 'Enter' && aberto && filteredOptions.length) {
          event.preventDefault();
          const option = filteredOptions[0];
          selected = option;
          hidden.value = option.value;
          input.value = option.label;
          fecharLista();
          renderList();
        }
      });

      input.addEventListener('blur', () => {
        window.setTimeout(() => {
          restaurarSelecao();
          fecharLista();
        }, 120);
      });

      return {
        getValue: () => hidden.value,
        getSelectedOption: () => options.find(option => option.value === hidden.value) || null,
        setValue: (value) => {
          const option = options.find(item => item.value === value);
          if (!option) return;
          selected = option;
          hidden.value = option.value;
          input.value = option.label;
        },
        clear: () => {
          selected = null;
          hidden.value = '';
          input.value = '';
        }
      };
    }

    const clienteCombobox = criarCombobox({
      mountId: 'venda-cliente-combobox',
      inputId: 'venda-cliente-input',
      listId: 'venda-cliente-lista',
      hiddenId: 'venda-cliente',
      placeholder: 'Digite para buscar cliente...',
      options: clienteOpcoes,
      initialValue: '',
      fallbackValue: ''
    });

    const produtoCombobox = criarCombobox({
      mountId: 'venda-produto-combobox',
      inputId: 'venda-produto-input',
      listId: 'venda-produto-lista',
      hiddenId: 'venda-produto',
      placeholder: 'Digite para buscar produto...',
      options: produtoOpcoes,
      initialValue: '',
      fallbackValue: null
    });

    function _qtdReservada(variacaoId) {
      const item = carrinho.find(entry => entry.variacao_id === variacaoId);
      return item ? item.qtd : 0;
    }

    function _estoqueTotalVariacao(variacaoId) {
      const variacao = (produtoBuscado?.variacoes || []).find(item => item.id === variacaoId);
      if (!variacao) return null;
      return (variacao.estoque || []).reduce((soma, estoque) => soma + estoque.quantidade, 0);
    }

    function _renderVariacoesBuscadas() {
      const container = document.getElementById('venda-variacoes-container');
      if (!produtoBuscado) {
        container.innerHTML = '';
        return;
      }

      const variacoesDisponiveis = (produtoBuscado.variacoes || []).map(v => {
        const estoqueTotal = (v.estoque || []).reduce((soma, estoque) => soma + estoque.quantidade, 0);
        const disponivel = Math.max(0, estoqueTotal - _qtdReservada(v.id));
        return { ...v, disponivel };
      }).filter(v => v.disponivel > 0);

      if (!variacoesDisponiveis.length) {
        container.innerHTML = `<div class="alert alert-warning">⚠️ Todas as variações com estoque disponível já foram adicionadas ao carrinho.</div>`;
        return;
      }

      container.innerHTML = `
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
          <div style="margin-bottom:10px;font-weight:600">${produtoBuscado.nome} — Selecione a variação</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${variacoesDisponiveis.map(v => `
              <button type="button" class="btn btn-outline btn-sm"
                onclick="PageVendas._adicionarAoCarrinho(${JSON.stringify({id:v.id, tamanho:v.tamanho, cor:v.cor}).replace(/"/g,'&quot;')}, '${produtoBuscado.nome.replace(/'/g, "\\'")}', ${produtoBuscado.preco}, ${produtoBuscado.custo})"
                style="flex-direction:column;gap:2px;padding:8px 12px">
                <span style="font-weight:700">Tam ${v.tamanho}</span>
                <span style="font-size:11px;color:var(--text-muted)">${v.cor} · ${v.disponivel} un.</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    async function _buscarVariacoesSelecionadas() {
      const prodId = produtoCombobox.getValue();
      if (!prodId) { toast('Selecione um produto.', 'info'); return; }

      const prod = await API.produtos.obter(prodId);
      const produtoSelecionado = produtoCombobox.getSelectedOption();
      const preco = parseFloat(produtoSelecionado?.meta?.preco) || 0;
      const custo = parseFloat(produtoSelecionado?.meta?.custo) || 0;

      produtoBuscado = {
        id: prod.id,
        nome: prod.nome,
        preco,
        custo,
        variacoes: prod.variacoes || []
      };

      _renderVariacoesBuscadas();
    }

    function _atualizarTrocoArea() {
      const trocoArea = document.getElementById('venda-troco-area');
      const formaPagamento = document.getElementById('venda-pagamento').value;
      const statusPagamento = document.getElementById('venda-status-pagamento').value;
      trocoArea.style.display = formaPagamento === 'dinheiro' && statusPagamento === 'pago' ? 'block' : 'none';
      if (trocoArea.style.display === 'none') {
        document.getElementById('venda-troco-box').innerHTML = '';
      }
    }

    // Buscar variações ao selecionar produto
    document.getElementById('btn-buscar-variacoes').addEventListener('click', _buscarVariacoesSelecionadas);

    // Troco
    document.getElementById('venda-pagamento').addEventListener('change', _atualizarTrocoArea);
    document.getElementById('venda-status-pagamento').addEventListener('change', _atualizarTrocoArea);
    document.getElementById('venda-recebido').addEventListener('input', () => {
      const total = _calcTotal();
      const recebido = parseFloat(document.getElementById('venda-recebido').value) || 0;
      const troco = recebido - total;
      document.getElementById('venda-troco-box').innerHTML = troco >= 0
        ? `<div class="troco-box">Troco: <strong>${Utils.moeda(troco)}</strong></div>`
        : `<div class="alert alert-danger">Valor insuficiente!</div>`;
    });

    // Desconto
    document.getElementById('venda-desconto').addEventListener('input', _atualizarTotais);

    function _calcTotal() {
      const sub = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
      const desc = parseFloat(document.getElementById('venda-desconto')?.value) || 0;
      return Math.max(0, sub - desc);
    }

    function _atualizarTotais() {
      const sub = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
      const desc = parseFloat(document.getElementById('venda-desconto')?.value) || 0;
      const total = Math.max(0, sub - desc);
      document.getElementById('span-subtotal').textContent = Utils.moeda(sub);
      document.getElementById('span-desconto').textContent = '- ' + Utils.moeda(desc);
      document.getElementById('span-total').textContent = Utils.moeda(total);
    }

    function _renderCarrinho() {
      const el = document.getElementById('venda-carrinho');
      if (!carrinho.length) {
        el.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🛒</div><p>Nenhum item adicionado.</p></div>`;
      } else {
        el.innerHTML = carrinho.map((item, idx) => {
          const estoqueTotal = _estoqueTotalVariacao(item.variacao_id);
          const atingiuMaximo = estoqueTotal !== null && item.qtd >= estoqueTotal;

          return `
            <div class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">${item.nome}</div>
                <div class="cart-item-meta">Tam ${item.tamanho} · ${item.cor}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-left:10px">
                <button class="btn btn-ghost btn-sm" onclick="PageVendas._qtdCarrinho(${idx},-1)">−</button>
                <span style="font-weight:700;min-width:24px;text-align:center">${item.qtd}</span>
                <button class="btn btn-ghost btn-sm" onclick="PageVendas._qtdCarrinho(${idx},1)" ${atingiuMaximo ? 'disabled title="Estoque maximo atingido"' : ''}>+</button>
                <span class="cart-item-price">${Utils.moeda(item.preco * item.qtd)}</span>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageVendas._removerCarrinho(${idx})">✕</button>
              </div>
            </div>
          `;
        }).join('');
      }
      _atualizarTotais();
    }

    // Expor métodos para onclick inline
    PageVendas._adicionarAoCarrinho = (variacao, nome, preco, custo) => {
      const existente = carrinho.find(i => i.variacao_id === variacao.id);
      const estoqueTotal = _estoqueTotalVariacao(variacao.id);

      if (existente) {
        if (estoqueTotal !== null && existente.qtd >= estoqueTotal) {
          toast('Quantidade maxima em estoque atingida para esta variacao.', 'info');
          return;
        }
        existente.qtd++;
      } else {
        carrinho.push({ variacao_id: variacao.id, tamanho: variacao.tamanho, cor: variacao.cor, nome, preco, custo, qtd: 1 });
      }

      _renderVariacoesBuscadas();
      _renderCarrinho();
    };

    PageVendas._qtdCarrinho = (idx, delta) => {
      const item = carrinho[idx];
      const proximaQtd = Math.max(1, item.qtd + delta);
      const estoqueTotal = _estoqueTotalVariacao(item.variacao_id);

      if (delta > 0 && estoqueTotal !== null && proximaQtd > estoqueTotal) {
        toast('Nao e possivel vender mais do que o estoque disponivel.', 'info');
        return;
      }

      item.qtd = proximaQtd;
      _renderVariacoesBuscadas();
      _renderCarrinho();
    };

    PageVendas._removerCarrinho = (idx) => {
      carrinho.splice(idx, 1);
      _renderVariacoesBuscadas();
      _renderCarrinho();
    };

    _renderCarrinho();
    _atualizarTrocoArea();

    // Confirmar venda
    document.getElementById('btn-confirmar-venda').addEventListener('click', async () => {
      if (!carrinho.length) { toast('Adicione ao menos um item.', 'info'); return; }
      const desc = parseFloat(document.getElementById('venda-desconto').value) || 0;
      const sub = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
      const total = Math.max(0, sub - desc);
      const dados = {
        cliente_id: clienteCombobox.getValue() || null,
        total,
        desconto: desc,
        forma_pagamento: document.getElementById('venda-pagamento').value,
        status_pagamento: document.getElementById('venda-status-pagamento').value,
        observacoes: document.getElementById('venda-obs').value,
        itens: carrinho.map(i => ({
          variacao_id: i.variacao_id,
          quantidade: i.qtd,
          preco_unit: i.preco,
          custo_unit: i.custo,
        }))
      };
      try {
        const r = await API.vendas.criar(dados);
        toast(`Venda #${r.id} realizada com sucesso! 🎉`, 'success');
        Modal.close();
        await carregar();
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  // Ver detalhe
  async function verDetalhe(id) {
    try {
      const v = await API.vendas.obter(id);
      Modal.open(`🛒 Venda #${v.id}`, `
        <div style="margin-bottom:16px">
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13.5px">
            <div><strong>Data:</strong> ${Utils.dataHora(v.criado_em)}</div>
            <div><strong>Cliente:</strong> ${v.cliente_nome || 'Avulso'}</div>
            <div><strong>Pagamento:</strong> ${Utils.formaPagamentoLabel(v.forma_pagamento)}</div>
            <div><strong>Situação:</strong> <span class="badge ${badgeStatusPagamento(v.status_pagamento)}">${labelStatusPagamento(v.status_pagamento)}</span></div>
            <div><strong>Status:</strong> <span class="badge ${badgeStatusVenda(v.status)}">${v.status}</span></div>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Produto</th><th>Var.</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${(v.itens || []).map(i => `
                <tr>
                  <td>${i.produto_nome}</td>
                  <td>Tam ${i.tamanho} · ${i.cor}</td>
                  <td>${i.quantidade}</td>
                  <td>${Utils.moeda(i.preco_unit)}</td>
                  <td><strong>${Utils.moeda(i.preco_unit * i.quantidade)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="cart-total-area" style="margin-top:14px">
          ${v.desconto > 0 ? `<div class="cart-total-row"><span>Desconto:</span><span>- ${Utils.moeda(v.desconto)}</span></div>` : ''}
          <div class="cart-total-row grand"><span>TOTAL:</span><span>${Utils.moeda(v.total)}</span></div>
        </div>
        ${v.observacoes ? `<p style="margin-top:12px;color:var(--text-muted);font-size:13px">📝 ${v.observacoes}</p>` : ''}
        ${v.status === 'concluida' ? `
          <div class="form-actions" style="margin-top:16px">
            ${!v.cliente_id ? `<button class="btn btn-outline" onclick="PageVendas.vincularCliente(${v.id})">👤 Vincular Cliente</button>` : ''}
            ${v.status_pagamento !== 'pago' ? `<button class="btn btn-success" onclick="PageVendas.marcarComoPaga(${v.id})">✅ Marcar como Paga</button>` : ''}
            <button class="btn btn-danger" onclick="PageVendas.cancelar(${v.id})">❌ Cancelar Esta Venda</button>
          </div>` : ''
        }
      `);
    } catch(e) {
      toast('Erro ao carregar detalhe.', 'error');
    }
  }

  async function cancelar(id) {
    const ok = await Modal.confirm(
      `Deseja cancelar a <strong>venda #${id}</strong>?<br><small style="color:var(--text-muted)">O estoque dos itens será reposto automaticamente e o lançamento financeiro será removido.</small>`,
      { titulo: 'Cancelar Venda', textoBotaoOk: '🚫 Cancelar Venda', icone: '🛒' }
    );
    if (!ok) return;
    try {
      await API.vendas.cancelar(id);
      toast('Venda cancelada. Estoque reposto.', 'success');
      Modal.close();
      await carregar();
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  async function marcarComoPaga(id) {
    try {
      await API.vendas.pagar(id);
      toast('Venda marcada como paga.', 'success');
      Modal.close();
      await carregar();
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  async function vincularCliente(id) {
    try {
      const [venda, clientes] = await Promise.all([API.vendas.obter(id), API.clientes.listar()]);

      if (venda.cliente_id) {
        toast('Esta venda já possui cliente vinculado.', 'info');
        return;
      }

      if (!clientes.length) {
        toast('Nenhum cliente cadastrado para vincular.', 'info');
        return;
      }

      Modal.open(`👤 Vincular Cliente na Venda #${venda.id}`, `
        <div>
          <p style="margin:0 0 14px;color:var(--text-muted);font-size:13px">Selecione um cliente cadastrado para substituir o atendimento avulso desta venda.</p>
          <div class="form-group">
            <label class="form-label">Cliente</label>
            <select class="form-control" id="venda-vincular-cliente">
              <option value="">Selecione um cliente</option>
              ${clientes.map(cliente => `<option value="${cliente.id}">${cliente.nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="PageVendas.verDetalhe(${venda.id})">Voltar</button>
            <button type="button" class="btn btn-primary" id="btn-vincular-cliente-venda">Salvar Cliente</button>
          </div>
        </div>
      `);

      document.getElementById('btn-vincular-cliente-venda').addEventListener('click', async () => {
        const clienteId = document.getElementById('venda-vincular-cliente').value;
        if (!clienteId) {
          toast('Selecione um cliente para continuar.', 'info');
          return;
        }

        await API.vendas.vincularCliente(venda.id, { cliente_id: Number(clienteId) });
        toast('Cliente vinculado à venda.', 'success');
        await carregar();
        await verDetalhe(venda.id);
      });
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  return { render, verDetalhe, cancelar, marcarComoPaga, vincularCliente };
})();
