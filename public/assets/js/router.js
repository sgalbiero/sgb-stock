/* router.js — Roteamento SPA leve via hash */

const Router = (() => {
  // Mapa de rota -> função de renderização
  const routes = {};

  function register(hash, fn) {
    routes[hash] = fn;
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function getCurrentPage() {
    return window.location.hash.replace('#/', '') || 'dashboard';
  }

  function render() {
    const page = getCurrentPage().split('/')[0];
    const container = document.getElementById('page-container');

    if (!window.Auth?.isInitialized()) {
      container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Carregando...</p></div>';
      return;
    }

    if (!window.Auth.isAuthenticated()) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      window.Auth.renderLogin(container);
      return;
    }

    if (!window.Auth.canAccessPage(page)) {
      const fallback = window.Auth.defaultPage();
      if (page !== fallback) {
        toast('Você não tem acesso a esta página.', 'error');
        navigate('/' + fallback);
        return;
      }
    }

    // Atualizar nav ativo
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const fn = routes[page];
    if (fn) {
      container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Carregando...</p></div>';
      fn(container);
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>Página não encontrada: <strong>${page}</strong></p>
        </div>`;
    }
  }

  function init() {
    window.addEventListener('hashchange', render);

    // Sidebar toggle
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    }

    // --- Alternância de tema ---
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon  = themeBtn?.querySelector('.theme-icon');
    const themeLabel = themeBtn?.querySelector('.theme-label');

    function aplicarTema(tema) {
      if (tema === 'light') {
        document.documentElement.setAttribute('data-tema', 'light');
        if (themeIcon)  themeIcon.textContent  = '☀️';
        if (themeLabel) themeLabel.textContent  = 'Modo Escuro';
      } else {
        document.documentElement.removeAttribute('data-tema');
        if (themeIcon)  themeIcon.textContent  = '🌙';
        if (themeLabel) themeLabel.textContent  = 'Modo Claro';
      }
      localStorage.setItem('sgb-tema', tema);
    }

    // Inicializar botão com o tema salvo (ou preferência do sistema)
    const temaSalvo = localStorage.getItem('sgb-tema')
      || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    aplicarTema(temaSalvo);

    themeBtn?.addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-tema') === 'light' ? 'light' : 'dark';
      aplicarTema(atual === 'light' ? 'dark' : 'light');
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => window.Auth.logout());
    // --- fim tema ---

    // Iniciar na rota atual ou dashboard
    if (!window.location.hash) window.location.hash = '#/dashboard';
    else render();
  }

  return { register, navigate, init, getCurrentPage, render };
})();

window.Router = Router;

// Registrar todas as páginas
Router.register('dashboard',    (c) => PageDashboard.render(c));
Router.register('produtos',     (c) => PageProdutos.render(c));
Router.register('clientes',     (c) => PageClientes.render(c));
Router.register('fornecedores', (c) => PageFornecedores.render(c));
Router.register('vendas',       (c) => PageVendas.render(c));
Router.register('financeiro',   (c) => PageFinanceiro.render(c));
Router.register('historico',    (c) => PageHistorico.render(c));
Router.register('configuracoes', (c) => PageConfiguracoes.render(c));

Auth.init().then(() => Router.init());
