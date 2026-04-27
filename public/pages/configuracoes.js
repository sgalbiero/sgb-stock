/* configuracoes.js — Gestão administrativa do sistema */

const PageConfiguracoes = (() => {
  let _usuarios = [];
  let _categorias = [];
  let _locais = [];
  let _abaAtual = 'usuarios';

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">⚙️ Configurações</h1>
          <p class="page-subtitle">Gerencie usuários do sistema e tipos de lançamentos financeiros</p>
        </div>
      </div>

      <div class="tabs" id="config-tabs">
        <button class="tab-btn ${_abaAtual === 'usuarios' ? 'active' : ''}" data-tab="usuarios">Usuários</button>
        <button class="tab-btn ${_abaAtual === 'categorias' ? 'active' : ''}" data-tab="categorias">Lançamentos Financeiros</button>
        <button class="tab-btn ${_abaAtual === 'locais' ? 'active' : ''}" data-tab="locais">Locais de Estoque</button>
      </div>

      <div id="config-content"></div>
    `;

    document.querySelectorAll('#config-tabs [data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        _abaAtual = button.dataset.tab;
        render(container);
      });
    });

    await carregarAba();
  }

  async function carregarAba() {
    if (_abaAtual === 'usuarios') {
      await carregarUsuarios();
      renderUsuarios();
      return;
    }

    if (_abaAtual === 'locais') {
      await carregarLocais();
      renderLocais();
      return;
    }

    await carregarCategorias();
    renderCategorias();
  }

  async function carregarUsuarios() {
    _usuarios = await API.auth.listarUsuarios();
  }

  function renderUsuarios() {
    const content = document.getElementById('config-content');
    content.innerHTML = `
      <div class="card">
        <div class="page-header" style="margin-bottom:16px">
          <div>
            <div class="card-title" style="margin-bottom:4px">👤 Usuários do Sistema</div>
            <p class="page-subtitle">Cadastre, edite e redefina senhas dos usuários autorizados.</p>
          </div>
          <button class="btn btn-primary" id="btn-novo-usuario">+ Novo Usuário</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>
              ${_usuarios.map(usuario => `
                <tr>
                  <td><strong>${usuario.nome}</strong></td>
                  <td>${usuario.login}</td>
                  <td><span class="badge ${usuario.perfil === 'admin' ? 'badge-purple' : 'badge-blue'}">${usuario.perfil}</span></td>
                  <td><span class="badge ${usuario.ativo ? 'badge-green' : 'badge-red'}">${usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td>${Utils.dataHora(usuario.criado_em)}</td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" onclick="PageConfiguracoes.editarUsuario(${usuario.id})" title="Editar">✏️</button>
                      <button class="btn btn-ghost btn-sm" onclick="PageConfiguracoes.resetarSenha(${usuario.id})" title="Redefinir senha">🔐</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-usuario').addEventListener('click', () => abrirFormularioUsuario());
  }

  async function carregarCategorias() {
    _categorias = await API.financeiro.categorias();
  }

  async function carregarLocais() {
    _locais = await API.locais.listar();
  }

  function renderCategorias() {
    const content = document.getElementById('config-content');
    content.innerHTML = `
      <div class="card">
        <div class="page-header" style="margin-bottom:16px">
          <div>
            <div class="card-title" style="margin-bottom:4px">💰 Tipos de Lançamentos</div>
            <p class="page-subtitle">Crie e edite categorias de receita e despesa usadas no Financeiro.</p>
          </div>
          <button class="btn btn-primary" id="btn-nova-categoria">+ Nova Categoria</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Ações</th></tr></thead>
            <tbody>
              ${_categorias.map(categoria => `
                <tr>
                  <td><strong>${categoria.nome}</strong></td>
                  <td><span class="badge ${categoria.tipo === 'receita' ? 'badge-green' : 'badge-red'}">${categoria.tipo}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" onclick="PageConfiguracoes.editarCategoria(${categoria.id})" title="Editar">✏️</button>
                      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageConfiguracoes.excluirCategoria(${categoria.id}, '${categoria.nome.replace(/'/g, "\\'")}')" title="Excluir">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-nova-categoria').addEventListener('click', () => abrirFormularioCategoria());
  }

  function renderLocais() {
    const content = document.getElementById('config-content');
    content.innerHTML = `
      <div class="card">
        <div class="page-header" style="margin-bottom:16px">
          <div>
            <div class="card-title" style="margin-bottom:4px">🏬 Locais de Estoque</div>
            <p class="page-subtitle">Cadastre novos locais para entrada de estoque. O local padrão Loja Principal é protegido.</p>
          </div>
          <button class="btn btn-primary" id="btn-novo-local">+ Novo Local</button>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Uso em estoque</th><th>Ações</th></tr></thead>
            <tbody>
              ${_locais.map(local => `
                <tr>
                  <td><strong>${local.nome}</strong>${local.nome === 'Loja Principal' ? ' <span class="badge badge-purple">padrão</span>' : ''}</td>
                  <td>${local.registros_estoque || 0} registro(s)</td>
                  <td>
                    <div class="action-btns">
                      ${local.nome !== 'Loja Principal' ? `<button class="btn btn-ghost btn-sm" onclick="PageConfiguracoes.editarLocal(${local.id})" title="Editar">✏️</button>` : ''}
                      ${local.nome !== 'Loja Principal' ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="PageConfiguracoes.excluirLocal(${local.id}, '${local.nome.replace(/'/g, "\\'")}')" title="Excluir">🗑️</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-novo-local').addEventListener('click', () => abrirFormularioLocal());
  }

  function abrirFormularioUsuario(usuario = null) {
    const titulo = usuario ? 'Editar Usuário' : 'Novo Usuário';
    Modal.open(titulo, `
      <form id="form-usuario-admin">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-control" id="config-usuario-nome" type="text" value="${usuario?.nome || ''}" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Login</label>
            <input class="form-control" id="config-usuario-login" type="text" value="${usuario?.login || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Perfil</label>
            <select class="form-control" id="config-usuario-perfil">
              <option value="admin" ${usuario?.perfil === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="vendedor" ${usuario?.perfil === 'vendedor' ? 'selected' : ''}>Vendedor</option>
            </select>
          </div>
        </div>
        ${usuario ? '' : `
          <div class="form-group">
            <label class="form-label">Senha inicial</label>
            <input class="form-control" id="config-usuario-senha" type="password" required />
          </div>
        `}
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="config-usuario-ativo">
            <option value="1" ${usuario?.ativo !== 0 ? 'selected' : ''}>Ativo</option>
            <option value="0" ${usuario?.ativo === 0 ? 'selected' : ''}>Inativo</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    document.getElementById('form-usuario-admin').addEventListener('submit', async event => {
      event.preventDefault();
      const dados = {
        nome: document.getElementById('config-usuario-nome').value,
        login: document.getElementById('config-usuario-login').value,
        perfil: document.getElementById('config-usuario-perfil').value,
        ativo: document.getElementById('config-usuario-ativo').value === '1',
      };

      if (!usuario) dados.senha = document.getElementById('config-usuario-senha').value;

      try {
        if (usuario) {
          await API.auth.atualizarUsuario(usuario.id, dados);
          toast('Usuário atualizado com sucesso.', 'success');
        } else {
          await API.auth.criarUsuario(dados);
          toast('Usuário criado com sucesso.', 'success');
        }
        Modal.close();
        await carregarUsuarios();
        renderUsuarios();
      } catch (error) {
        toast('Erro: ' + error.message, 'error');
      }
    });
  }

  function abrirFormularioCategoria(categoria = null) {
    Modal.open(categoria ? 'Editar Categoria' : 'Nova Categoria', `
      <form id="form-categoria-admin">
        <div class="form-group">
          <label class="form-label">Nome</label>
          <input class="form-control" id="config-categoria-nome" type="text" value="${categoria?.nome || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-control" id="config-categoria-tipo">
            <option value="receita" ${categoria?.tipo === 'receita' ? 'selected' : ''}>Receita</option>
            <option value="despesa" ${categoria?.tipo === 'despesa' ? 'selected' : ''}>Despesa</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    document.getElementById('form-categoria-admin').addEventListener('submit', async event => {
      event.preventDefault();
      const dados = {
        nome: document.getElementById('config-categoria-nome').value,
        tipo: document.getElementById('config-categoria-tipo').value,
      };

      try {
        if (categoria) {
          await API.financeiro.atualizarCategoria(categoria.id, dados);
          toast('Categoria atualizada com sucesso.', 'success');
        } else {
          await API.financeiro.criarCategoria(dados);
          toast('Categoria criada com sucesso.', 'success');
        }
        Modal.close();
        await carregarCategorias();
        renderCategorias();
      } catch (error) {
        toast('Erro: ' + error.message, 'error');
      }
    });
  }

  async function editarUsuario(id) {
    const usuario = _usuarios.find(item => item.id === id);
    if (!usuario) return;
    abrirFormularioUsuario(usuario);
  }

  async function resetarSenha(id) {
    const usuario = _usuarios.find(item => item.id === id);
    if (!usuario) return;

    Modal.open(`🔐 Redefinir Senha — ${usuario.nome}`, `
      <form id="form-reset-senha-admin">
        <div class="form-group">
          <label class="form-label">Nova senha</label>
          <input class="form-control" id="config-reset-senha" type="password" required />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar nova senha</button>
        </div>
      </form>
    `);

    document.getElementById('form-reset-senha-admin').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await API.auth.resetarSenhaUsuario(usuario.id, { senha: document.getElementById('config-reset-senha').value });
        toast('Senha redefinida com sucesso.', 'success');
        Modal.close();
      } catch (error) {
        toast('Erro: ' + error.message, 'error');
      }
    });
  }

  async function editarCategoria(id) {
    const categoria = _categorias.find(item => item.id === id);
    if (!categoria) return;
    abrirFormularioCategoria(categoria);
  }

  async function excluirCategoria(id, nome) {
    const ok = await Modal.confirm(
      `Deseja excluir a categoria <strong>${nome}</strong>?<br><small style="color:var(--text-muted)">Ela só poderá ser removida se ainda não tiver sido usada em lançamentos.</small>`,
      { titulo: 'Excluir Categoria', textoBotaoOk: '🗑️ Excluir', icone: '💰' }
    );
    if (!ok) return;

    try {
      await API.financeiro.excluirCategoria(id);
      toast('Categoria excluída com sucesso.', 'success');
      await carregarCategorias();
      renderCategorias();
    } catch (error) {
      toast('Erro: ' + error.message, 'error');
    }
  }

  function abrirFormularioLocal(local = null) {
    Modal.open(local ? 'Editar Local de Estoque' : 'Novo Local de Estoque', `
      <form id="form-local-admin">
        <div class="form-group">
          <label class="form-label">Nome do local</label>
          <input class="form-control" id="config-local-nome" type="text" value="${local?.nome || ''}" required />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Salvar</button>
        </div>
      </form>
    `);

    document.getElementById('form-local-admin').addEventListener('submit', async event => {
      event.preventDefault();
      const dados = { nome: document.getElementById('config-local-nome').value };

      try {
        if (local) {
          await API.locais.atualizar(local.id, dados);
          toast('Local atualizado com sucesso.', 'success');
        } else {
          await API.locais.criar(dados);
          toast('Local criado com sucesso.', 'success');
        }
        Modal.close();
        await carregarLocais();
        renderLocais();
      } catch (error) {
        toast('Erro: ' + error.message, 'error');
      }
    });
  }

  async function editarLocal(id) {
    const local = _locais.find(item => item.id === id);
    if (!local) return;
    abrirFormularioLocal(local);
  }

  async function excluirLocal(id, nome) {
    const ok = await Modal.confirm(
      `Deseja excluir o local <strong>${nome}</strong>?<br><small style="color:var(--text-muted)">Ele só poderá ser removido se não houver estoque registrado nele.</small>`,
      { titulo: 'Excluir Local', textoBotaoOk: '🗑️ Excluir', icone: '🏬' }
    );
    if (!ok) return;

    try {
      await API.locais.excluir(id);
      toast('Local excluído com sucesso.', 'success');
      await carregarLocais();
      renderLocais();
    } catch (error) {
      toast('Erro: ' + error.message, 'error');
    }
  }

  return { render, editarUsuario, resetarSenha, editarCategoria, excluirCategoria, editarLocal, excluirLocal };
})();