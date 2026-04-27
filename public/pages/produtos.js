/* produtos.js — Listagem, cadastro com variações dinâmicas e gestão de estoque */

const PageProdutos = (() => {

  let _todos = [];

  function normalizarTexto(valor) {
    return (valor || '').toString().toLowerCase();
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📦 Produtos</h1>
          <p class="page-subtitle">Gerencie produtos, variações e estoque</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-outline" id="btn-produtos-excluidos" title="Ver produtos excluídos">🗑️</button>
          <button class="btn btn-primary" id="btn-novo-produto">+ Novo Produto</button>
        </div>
      </div>
      <div class="toolbar">
        <input class="search-input" id="busca-produto" type="text" placeholder="Buscar por nome, SKU ou fornecedor..." />
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead><tr><th>SKU</th><th>Nome</th><th>Fornecedores</th><th>Custo</th><th>Preço</th><th>Margem</th><th>Ações</th></tr></thead>
            <tbody id="tabela-produtos"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-produto').addEventListener('click', () => abrirFormulario());
    document.getElementById('btn-produtos-excluidos').addEventListener('click', abrirProdutosExcluidos);
    document.getElementById('busca-produto').addEventListener('input', e => filtrar(e.target.value));

    await carregar();
  }

  async function carregar() {
    try {
      _todos = await API.produtos.listar();
      renderTabela(_todos);
    } catch(e) {
      toast('Erro ao carregar produtos: ' + e.message, 'error');
    }
  }

  function filtrar(termo) {
    const t = normalizarTexto(termo);
    renderTabela(_todos.filter(p =>
      normalizarTexto(p.nome).includes(t) ||
      normalizarTexto(p.sku).includes(t) ||
      normalizarTexto(p.fornecedor_nomes).includes(t)
    ));
  }

  function renderTabela(lista) {
    const tbody = document.getElementById('tabela-produtos');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>Nenhum produto encontrado.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(p => `
      <tr>
        <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:12px">${p.sku}</code></td>
        <td><strong>${p.nome}</strong></td>
        <td>${p.fornecedor_nomes ? p.fornecedor_nomes.split(' | ').join(', ') : '<span style="color:var(--text-faint)">—</span>'}</td>
        <td>${Utils.moeda(p.custo)}</td>
        <td><strong>${Utils.moeda(p.preco)}</strong></td>
        <td><span class="badge badge-purple">${Utils.margem(p.custo, p.preco)}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn-ghost btn-sm" onclick="PageProdutos.verEstoque(${p.id})" title="Ver estoque">📊</button>
            <button class="btn btn-ghost btn-sm" onclick="PageProdutos.editar(${p.id})" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageProdutos.desativar(${p.id}, '${p.nome}')" title="Desativar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function abrirFormulario(produto = null) {
    const titulo = produto ? 'Editar Produto' : 'Novo Produto';
    const fornecedores = await API.fornecedores.listar();
    const fornecedoresSelecionados = new Set((produto?.fornecedores || []).map(f => f.id));
    Modal.open(titulo, `
      <form id="form-produto">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">SKU *</label>
            <input class="form-control" id="prod-sku" type="text" value="${produto?.sku || ''}" required placeholder="Ex: TEN-001" />
          </div>
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="prod-nome" type="text" value="${produto?.nome || ''}" required placeholder="Nome do produto" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Custo (R$)</label>
            <input class="form-control" id="prod-custo" type="number" step="0.01" min="0" value="${produto?.custo || 0}" />
          </div>
          <div class="form-group">
            <label class="form-label">Preço de Venda (R$)</label>
            <input class="form-control" id="prod-preco" type="number" step="0.01" min="0" value="${produto?.preco || 0}" />
          </div>
        </div>
        <div id="margem-preview" style="font-size:12px;color:var(--text-muted);margin-bottom:16px"></div>

        <div class="form-group">
          <label class="form-label">Fornecedores</label>
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;background:var(--bg);display:grid;gap:8px;max-height:220px;overflow:auto">
            ${fornecedores.length
              ? fornecedores.map(f => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                  <input type="checkbox" class="prod-fornecedor" value="${f.id}" ${fornecedoresSelecionados.has(f.id) ? 'checked' : ''} />
                  <span>${f.nome}</span>
                </label>
              `).join('')
              : '<small style="color:var(--text-muted)">Nenhum fornecedor ativo cadastrado.</small>'}
          </div>
          <small style="display:block;margin-top:8px;color:var(--text-muted)">Selecione um ou mais fornecedores vinculados a este produto.</small>
        </div>

        ${!produto ? `
        <div class="form-group">
          <label class="form-label">Variações (Tamanho / Cor)</label>
          <div id="variacoes-container" class="variacoes-list"></div>
          <button type="button" class="btn btn-outline btn-sm" id="btn-add-var">+ Adicionar Variação</button>
        </div>
        ` : ''}

        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    // Margem preview em tempo real
    const custoEl = document.getElementById('prod-custo');
    const precoEl = document.getElementById('prod-preco');
    const margemEl = document.getElementById('margem-preview');
    function atualizarMargem() {
      const c = parseFloat(custoEl.value) || 0;
      const p = parseFloat(precoEl.value) || 0;
      margemEl.textContent = `Margem: ${Utils.margem(c, p)}`;
    }
    custoEl.addEventListener('input', atualizarMargem);
    precoEl.addEventListener('input', atualizarMargem);
    atualizarMargem();

    // Variações dinâmicas (apenas para novo produto)
    if (!produto) {
      const varContainer = document.getElementById('variacoes-container');
      document.getElementById('btn-add-var').addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'variacao-row';
        row.innerHTML = `
          <input class="form-control var-tamanho" type="text" placeholder="Tamanho (ex: 38)" />
          <input class="form-control var-cor" type="text" placeholder="Cor (ex: Preto)" />
          <input class="form-control var-sku" type="text" placeholder="SKU variação (opcional)" />
          <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="this.parentElement.remove()">✕</button>
        `;
        varContainer.appendChild(row);
      });
    }

    document.getElementById('form-produto').addEventListener('submit', async e => {
      e.preventDefault();
      const dados = {
        sku: document.getElementById('prod-sku').value,
        nome: document.getElementById('prod-nome').value,
        custo: parseFloat(document.getElementById('prod-custo').value) || 0,
        preco: parseFloat(document.getElementById('prod-preco').value) || 0,
        fornecedor_ids: Array.from(document.querySelectorAll('.prod-fornecedor:checked')).map(el => parseInt(el.value, 10)),
      };

      if (!produto) {
        // Coletar variações
        const rows = document.querySelectorAll('#variacoes-container .variacao-row');
        dados.variacoes = Array.from(rows).map(r => ({
          tamanho: r.querySelector('.var-tamanho').value,
          cor: r.querySelector('.var-cor').value,
          sku_variacao: r.querySelector('.var-sku').value,
        })).filter(v => v.tamanho && v.cor);
      }

      try {
        if (produto) {
          await API.produtos.atualizar(produto.id, dados);
          toast('Produto atualizado!', 'success');
        } else {
          await API.produtos.criar(dados);
          toast('Produto criado!', 'success');
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
      const p = await API.produtos.obter(id);
      await abrirFormulario(p);
    } catch(e) {
      toast('Erro ao carregar produto.', 'error');
    }
  }

  async function abrirProdutosExcluidos() {
    try {
      const produtos = await API.produtos.listarInativos();
      Modal.open('🗑️ Produtos Excluídos', `
        <div id="produtos-excluidos-modal">
          ${!produtos.length ? `
            <div class="empty-state" style="padding:30px 0">
              <div class="empty-icon">🗑️</div>
              <p>Nenhum produto excluído.</p>
            </div>
          ` : `
            <div class="table-wrapper">
              <table>
                <thead><tr><th>SKU</th><th>Nome</th><th>Fornecedores</th><th>Ações</th></tr></thead>
                <tbody>
                  ${produtos.map(p => `
                    <tr>
                      <td><code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:12px">${p.sku}</code></td>
                      <td><strong>${p.nome}</strong></td>
                      <td>${p.fornecedor_nomes ? p.fornecedor_nomes.split(' | ').join(', ') : '<span style="color:var(--text-faint)">—</span>'}</td>
                      <td>
                        <button class="btn btn-success btn-sm" onclick="PageProdutos.recuperar(${p.id})">♻️ Recuperar</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
          <div class="form-actions" style="margin-top:16px">
            <button type="button" class="btn btn-outline" onclick="Modal.close()">Fechar</button>
          </div>
        </div>
      `);
    } catch (e) {
      toast('Erro ao carregar produtos excluídos: ' + e.message, 'error');
    }
  }

  async function recuperar(id) {
    try {
      await API.produtos.recuperar(id);
      toast('Produto recuperado.', 'success');
      Modal.close();
      await carregar();
      await abrirProdutosExcluidos();
    } catch (e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  async function verEstoque(id) {
    try {
      const produto = await API.produtos.obter(id);
      const variacoes = produto.variacoes || [];

      Modal.open(`📊 Estoque — ${produto.nome}`, `
        <div class="variacoes-list" id="estoque-list">
          ${variacoes.length === 0
            ? `<div class="empty-state" style="padding:24px"><div class="empty-icon">📦</div><p>Nenhuma variação cadastrada.</p></div>`
            : variacoes.map(v => {
                const totalEstoque = (v.estoque || []).reduce((s, e) => s + e.quantidade, 0);
                const cls = totalEstoque === 0 ? 'zero' : totalEstoque < 3 ? 'baixo' : 'ok';
                return `
                  <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                      <div>
                        <strong>Tam: ${v.tamanho}</strong> · Cor: ${v.cor}
                        ${v.sku_variacao ? `<span style="color:var(--text-faint);font-size:12px"> (${v.sku_variacao})</span>` : ''}
                      </div>
                      <span class="estoque-badge ${cls}">${totalEstoque} un.</span>
                    </div>
                    ${(v.estoque || []).map(e => `
                      <div style="font-size:12px;color:var(--text-muted)">${e.local}: ${e.quantidade} un.</div>
                    `).join('')}
                    <button class="btn btn-outline btn-sm" style="margin-top:10px"
                      onclick="PageProdutos.entradaEstoque(${v.id}, '${v.tamanho}', '${v.cor}', ${id})">
                      ➕ Entrada de Estoque
                    </button>
                  </div>
                `;
              }).join('')
          }
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-primary btn-sm" onclick="PageProdutos.adicionarVariacao(${id})">+ Nova Variação</button>
        </div>
      `);
    } catch(e) {
      toast('Erro ao carregar estoque.', 'error');
    }
  }

  async function entradaEstoque(variacaoId, tamanho, cor, produtoId) {
    Modal.open(`➕ Entrada de Estoque — Tam ${tamanho} / ${cor}`, `
      <form id="form-estoque">
        <div class="form-group">
          <label class="form-label">Quantidade a adicionar</label>
          <input class="form-control" id="est-qtd" type="number" min="1" value="1" required />
        </div>
        <div class="form-group">
          <label class="form-label">Local</label>
          <select class="form-control" id="est-local"></select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="PageProdutos.verEstoque(${produtoId})">← Voltar ao Estoque</button>
          <button type="submit" class="btn btn-success">✅ Confirmar Entrada</button>
        </div>
      </form>
    `);

    // Carregar locais de estoque
    try {
      const locaisResp = await fetch('/api/locais');
      if (locaisResp.ok) {
        const locais = await locaisResp.json();
        const sel = document.getElementById('est-local');
        sel.innerHTML = '';
        locais.forEach(l => {
          const op = document.createElement('option');
          op.value = l.id; op.textContent = l.nome;
          sel.appendChild(op);
        });
      }
    } catch(e) { /* ignora, usa padrão */ }

    // Fallback: se não carregou locais, adicionar opções padrão
    const sel = document.getElementById('est-local');
    if (sel && sel.options.length === 0) {
      sel.innerHTML = '<option value="1">Loja Principal</option><option value="2">Depósito</option>';
    }

    document.getElementById('form-estoque').addEventListener('submit', async e => {
      e.preventDefault();
      const qtd = parseInt(document.getElementById('est-qtd').value);
      const localId = parseInt(document.getElementById('est-local').value);
      try {
        await API.produtos.entradaEstoque(variacaoId, { local_id: localId, quantidade: qtd });
        toast(`${qtd} unidade(s) adicionada(s)!`, 'success');
        // Reabrir o painel de estoque atualizado (não fecha o modal)
        await verEstoque(produtoId);
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  async function adicionarVariacao(produtoId) {
    Modal.open('➕ Nova Variação', `
      <form id="form-nova-var">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tamanho *</label>
            <input class="form-control" id="var-tamanho" type="text" required placeholder="Ex: 38" />
          </div>
          <div class="form-group">
            <label class="form-label">Cor *</label>
            <input class="form-control" id="var-cor" type="text" required placeholder="Ex: Preto" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">SKU da Variação</label>
          <input class="form-control" id="var-sku" type="text" placeholder="Opcional" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Adicionar</button>
        </div>
      </form>
    `);
    document.getElementById('form-nova-var').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await API.produtos.adicionarVariacao(produtoId, {
          tamanho: document.getElementById('var-tamanho').value,
          cor: document.getElementById('var-cor').value,
          sku_variacao: document.getElementById('var-sku').value,
        });
        toast('Variação adicionada!', 'success');
        Modal.close();
      } catch(err) {
        toast('Erro: ' + err.message, 'error');
      }
    });
  }

  async function desativar(id, nome) {
    const ok = await Modal.confirm(
      `Deseja desativar o produto <strong>"${nome}"</strong>?<br><small style="color:var(--text-muted)">Ele não aparecerá mais nas listagens.</small>`,
      { titulo: 'Desativar Produto', textoBotaoOk: '🗑️ Desativar', icone: '📦' }
    );
    if (!ok) return;
    try {
      await API.produtos.desativar(id);
      toast('Produto desativado.', 'success');
      await carregar();
    } catch(e) {
      toast('Erro: ' + e.message, 'error');
    }
  }

  return { render, editar, verEstoque, entradaEstoque, adicionarVariacao, desativar, recuperar };
})();
