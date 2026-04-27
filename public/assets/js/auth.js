/* auth.js — Estado de autenticação e autorização no frontend */

const Auth = (() => {
  let usuarioAtual = null;
  let inicializado = false;

  const paginasPermitidas = {
    admin: ['dashboard', 'vendas', 'produtos', 'clientes', 'fornecedores', 'financeiro', 'historico', 'configuracoes'],
    vendedor: ['dashboard', 'vendas', 'produtos', 'clientes', 'fornecedores'],
  };

  function isAuthenticated() {
    return Boolean(usuarioAtual);
  }

  function isInitialized() {
    return inicializado;
  }

  function getUser() {
    return usuarioAtual;
  }

  function isAdmin() {
    return usuarioAtual?.perfil === 'admin';
  }

  function canManageFornecedores() {
    return isAdmin();
  }

  function canAccessPage(page) {
    if (!usuarioAtual) return false;
    return (paginasPermitidas[usuarioAtual.perfil] || []).includes(page);
  }

  function defaultPage() {
    return 'dashboard';
  }

  function aplicarEstadoVisual() {
    document.body.classList.toggle('login-mode', !usuarioAtual);

    const sidebarUser = document.getElementById('sidebar-user');
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserRole = document.getElementById('sidebar-user-role');
    const logoutBtn = document.getElementById('logout-btn');

    if (sidebarUser) sidebarUser.classList.toggle('hidden', !usuarioAtual);
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !usuarioAtual);

    if (usuarioAtual) {
      if (sidebarUserName) sidebarUserName.textContent = usuarioAtual.nome;
      if (sidebarUserRole) sidebarUserRole.textContent = usuarioAtual.perfil === 'admin' ? 'Administrador' : 'Vendedor';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      const permitido = usuarioAtual ? canAccessPage(item.dataset.page) : false;
      item.classList.toggle('hidden', !permitido);
    });
  }

  function renderLogin(container, errorMessage = '') {
    aplicarEstadoVisual();
    container.innerHTML = `
      <div class="login-shell">
        <div class="login-card">
          <div class="login-brand">
            <span class="login-brand-icon">👟</span>
            <div>
              <h1>SGB Stock</h1>
              <p>Entre com seu login para acessar o sistema.</p>
            </div>
          </div>
          <form id="form-login">
            <div class="form-group">
              <label class="form-label">Login</label>
              <input class="form-control" id="login-usuario" type="text" autocomplete="username" placeholder="Digite seu login" required />
            </div>
            <div class="form-group">
              <label class="form-label">Senha</label>
              <input class="form-control" id="login-senha" type="password" autocomplete="current-password" placeholder="Digite sua senha" required />
            </div>
            ${errorMessage ? `<div class="form-error" style="margin-bottom:12px">${errorMessage}</div>` : ''}
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">Entrar</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('form-login').addEventListener('submit', async event => {
      event.preventDefault();
      const login = document.getElementById('login-usuario').value;
      const senha = document.getElementById('login-senha').value;

      try {
        await loginComCredenciais(login, senha);
        const destino = canAccessPage(Router.getCurrentPage()) ? Router.getCurrentPage() : defaultPage();
        Router.navigate('/' + destino);
        Router.render();
      } catch (error) {
        renderLogin(container, error.message);
      }
    });
  }

  async function carregarUsuarioAtual() {
    try {
      const resposta = await API.auth.me();
      usuarioAtual = resposta.usuario;
    } catch (error) {
      usuarioAtual = null;
    }

    inicializado = true;
    aplicarEstadoVisual();
  }

  async function loginComCredenciais(login, senha) {
    const resposta = await API.auth.login({ login, senha });
    usuarioAtual = resposta.usuario;
    aplicarEstadoVisual();
    return usuarioAtual;
  }

  async function logout() {
    try {
      await API.auth.logout();
    } catch (error) {
      // Se a sessão já tiver expirado, seguimos limpando o estado local.
    }

    usuarioAtual = null;
    aplicarEstadoVisual();
    Router.render();
  }

  function handleUnauthorized() {
    if (!usuarioAtual) return;
    usuarioAtual = null;
    aplicarEstadoVisual();
    toast('Sua sessão expirou. Faça login novamente.', 'info');
    Router.render();
  }

  return {
    init: carregarUsuarioAtual,
    isAuthenticated,
    isInitialized,
    getUser,
    isAdmin,
    canManageFornecedores,
    canAccessPage,
    defaultPage,
    renderLogin,
    logout,
    handleUnauthorized,
  };
})();

window.Auth = Auth;