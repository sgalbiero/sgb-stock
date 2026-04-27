/* vendas.js — Nova venda, listagem e cancelamento */

const PageVendas = (() => {

  let _vendas = [];

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
        <button class="btn btn-outline" id="btn-limpar-filtros">Limpar</button>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tabela-vendas"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-nova-venda').addEventListener('click', abrirNovaVenda);
    document.getElementById('filtro-venda-data').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-venda-pagamento').addEventListener('change', aplicarFiltros);
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
      document.getElementById('filtro-venda-data').value = '';
      document.getElementById('filtro-venda-pagamento').value = '';
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
    let lista = [..._vendas];
    if (data) lista = lista.filter(v => v.criado_em && v.criado_em.startsWith(data));
    if (pagto) lista = lista.filter(v => v.forma_pagamento === pagto);
    renderTabela(lista);
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-vendas');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛒</div><p>Nenhuma venda encontrada.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(v => `
      <tr>
        <td><strong>#${v.id}</strong></td>
        <td style="white-space:nowrap">${Utils.dataHora(v.criado_em)}</td>
        <td>${v.cliente_nome || '<em style="color:var(--text-faint)">Avulso</em>'}</td>
        <td><strong>${Utils.moeda(v.total)}</strong></td>
        <td>${Utils.formaPagamentoLabel(v.forma_pagamento)}</td>
        <td><span class="badge ${v.status === 'concluida' ? 'badge-green' : 'badge-red'}">${v.status}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn-ghost btn-sm" onclick="PageVendas.verDetalhe(${v.id})" title="Ver detalhe">👁️</button>
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

    Modal.open('🛒 Nova Venda', `
      <div>
        <!-- Cliente -->
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <select class="form-control" id="venda-cliente">
            <option value="">— Vender sem cadastro (avulso) —</option>
            ${clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
          </select>
        </div>

        <!-- Busca de produto -->
        <div class="form-group">
          <label class="form-label">Adicionar Produto</label>
          <div style="display:flex;gap:8px">
            <select class="form-control" id="venda-produto" style="flex:1">
              <option value="">Selecione um produto...</option>
              ${produtos.map(p => `<option value="${p.id}" data-custo="${p.custo}" data-preco="${p.preco}">${p.nome} (${p.sku})</option>`).join('')}
            </select>
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

    // Buscar variações ao selecionar produto
    document.getElementById('btn-buscar-variacoes').addEventListener('click', async () => {
      const sel = document.getElementById('venda-produto');
      const prodId = sel.value;
      if (!prodId) { toast('Selecione um produto.', 'info'); return; }
      const prod = await API.produtos.obter(prodId);
      const variacoes = (prod.variacoes || []).filter(v => {
        const total = (v.estoque || []).reduce((s, e) => s + e.quantidade, 0);
        return total > 0;
      });
      const preco = parseFloat(sel.selectedOptions[0]?.dataset.preco) || 0;
      const custo = parseFloat(sel.selectedOptions[0]?.dataset.custo) || 0;

      const container = document.getElementById('venda-variacoes-container');
      if (!variacoes.length) {
        container.innerHTML = `<div class="alert alert-warning">⚠️ Nenhuma variação com estoque disponível.</div>`;
        return;
      }
      container.innerHTML = `
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
          <div style="margin-bottom:10px;font-weight:600">${prod.nome} — Selecione a variação</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${variacoes.map(v => {
              const totalEst = (v.estoque || []).reduce((s, e) => s + e.quantidade, 0);
              return `
                <button type="button" class="btn btn-outline btn-sm" 
                  onclick="PageVendas._adicionarAoCarrinho(${JSON.stringify({id:v.id, tamanho:v.tamanho, cor:v.cor}).replace(/"/g,'&quot;')}, '${prod.nome}', ${preco}, ${custo})"
                  style="flex-direction:column;gap:2px;padding:8px 12px">
                  <span style="font-weight:700">Tam ${v.tamanho}</span>
                  <span style="font-size:11px;color:var(--text-muted)">${v.cor} · ${totalEst} un.</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    // Troco
    document.getElementById('venda-pagamento').addEventListener('change', e => {
      const trocoArea = document.getElementById('venda-troco-area');
      trocoArea.style.display = e.target.value === 'dinheiro' ? 'block' : 'none';
    });
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
        el.innerHTML = carrinho.map((item, idx) => `
          <div class="cart-item">
            <div class="cart-item-info">
              <div class="cart-item-name">${item.nome}</div>
              <div class="cart-item-meta">Tam ${item.tamanho} · ${item.cor}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-left:10px">
              <button class="btn btn-ghost btn-sm" onclick="PageVendas._qtdCarrinho(${idx},-1)">−</button>
              <span style="font-weight:700;min-width:24px;text-align:center">${item.qtd}</span>
              <button class="btn btn-ghost btn-sm" onclick="PageVendas._qtdCarrinho(${idx},1)">+</button>
              <span class="cart-item-price">${Utils.moeda(item.preco * item.qtd)}</span>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageVendas._removerCarrinho(${idx})">✕</button>
            </div>
          </div>
        `).join('');
      }
      _atualizarTotais();
    }

    // Expor métodos para onclick inline
    PageVendas._adicionarAoCarrinho = (variacao, nome, preco, custo) => {
      const existente = carrinho.find(i => i.variacao_id === variacao.id);
      if (existente) { existente.qtd++; }
      else { carrinho.push({ variacao_id: variacao.id, tamanho: variacao.tamanho, cor: variacao.cor, nome, preco, custo, qtd: 1 }); }
      document.getElementById('venda-variacoes-container').innerHTML = '';
      document.getElementById('venda-produto').value = '';
      _renderCarrinho();
    };

    PageVendas._qtdCarrinho = (idx, delta) => {
      carrinho[idx].qtd = Math.max(1, carrinho[idx].qtd + delta);
      _renderCarrinho();
    };

    PageVendas._removerCarrinho = (idx) => {
      carrinho.splice(idx, 1);
      _renderCarrinho();
    };

    _renderCarrinho();

    // Confirmar venda
    document.getElementById('btn-confirmar-venda').addEventListener('click', async () => {
      if (!carrinho.length) { toast('Adicione ao menos um item.', 'info'); return; }
      const desc = parseFloat(document.getElementById('venda-desconto').value) || 0;
      const sub = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
      const total = Math.max(0, sub - desc);
      const dados = {
        cliente_id: document.getElementById('venda-cliente').value || null,
        total,
        desconto: desc,
        forma_pagamento: document.getElementById('venda-pagamento').value,
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
            <div><strong>Status:</strong> <span class="badge ${v.status === 'concluida' ? 'badge-green' : 'badge-red'}">${v.status}</span></div>
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

  return { render, verDetalhe, cancelar };
})();
