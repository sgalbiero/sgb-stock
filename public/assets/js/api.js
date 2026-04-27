/* api.js — Wrapper centralizado para chamadas à API */

const API = (() => {
  const BASE = '/api';

  async function request(method, path, body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(BASE + path, options);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 && !['/auth/login', '/auth/me'].includes(path) && window.Auth) {
        window.Auth.handleUnauthorized();
      }
      const msg = data?.error?.message || data?.error || 'Erro na requisição';
      throw new Error(msg);
    }
    return data;
  }

  const get  = (path)        => request('GET',    path);
  const post = (path, body)  => request('POST',   path, body);
  const put  = (path, body)  => request('PUT',    path, body);
  const del  = (path)        => request('DELETE', path);

  // --- Autenticação ---
  const auth = {
    login: (data) => post('/auth/login', data),
    logout: () => post('/auth/logout', {}),
    me: () => get('/auth/me'),
    listarUsuarios: () => get('/auth/usuarios'),
    criarUsuario: (data) => post('/auth/usuarios', data),
    atualizarUsuario: (id, data) => put(`/auth/usuarios/${id}`, data),
    resetarSenhaUsuario: (id, data) => put(`/auth/usuarios/${id}/senha`, data),
  };

  const historico = {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/historico' + (qs ? `?${qs}` : ''));
    },
    exportarUrl: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return BASE + '/historico/exportar.csv' + (qs ? `?${qs}` : '');
    },
  };

  // --- Produtos ---
  const produtos = {
    listar: ()           => get('/produtos'),
    listarInativos: ()   => get('/produtos/inativos'),
    obter:  (id)         => get(`/produtos/${id}`),
    criar:  (data)       => post('/produtos', data),
    atualizar: (id, data)=> put(`/produtos/${id}`, data),
    recuperar: (id)      => put(`/produtos/${id}/recuperar`),
    desativar: (id)      => del(`/produtos/${id}`),
    adicionarVariacao: (id, data) => post(`/produtos/${id}/variacoes`, data),
    desativarVariacao: (varId)    => del(`/produtos/variacoes/${varId}`),
    entradaEstoque: (varId, data) => post(`/produtos/variacoes/${varId}/estoque`, data),
  };

  // --- Clientes ---
  const clientes = {
    listar: ()            => get('/clientes'),
    obter:  (id)          => get(`/clientes/${id}`),
    historico: (id, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/clientes/${id}/historico` + (qs ? `?${qs}` : ''));
    },
    criar:  (data)        => post('/clientes', data),
    atualizar: (id, data) => put(`/clientes/${id}`, data),
  };

  // --- Fornecedores ---
  const fornecedores = {
    listar: ()            => get('/fornecedores'),
    obter:  (id)          => get(`/fornecedores/${id}`),
    criar:  (data)        => post('/fornecedores', data),
    atualizar: (id, data) => put(`/fornecedores/${id}`, data),
    desativar: (id)       => del(`/fornecedores/${id}`),
  };

  // --- Locais de Estoque ---
  const locais = {
    listar: () => get('/locais'),
    criar: (data) => post('/locais', data),
    atualizar: (id, data) => put(`/locais/${id}`, data),
    excluir: (id) => del(`/locais/${id}`),
  };

  // --- Vendas ---
  const vendas = {
    listar: ()      => get('/vendas'),
    obter:  (id)    => get(`/vendas/${id}`),
    criar:  (data)  => post('/vendas', data),
    vincularCliente: (id, data) => put(`/vendas/${id}/cliente`, data),
    pagar:  (id)    => put(`/vendas/${id}/pagar`),
    cancelar: (id)  => put(`/vendas/${id}/cancelar`),
  };

  // --- Financeiro ---
  const financeiro = {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro' + (qs ? '?' + qs : ''));
    },
    saldo:  (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/saldo' + (qs ? '?' + qs : ''));
    },
    fluxo:  (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/fluxo' + (qs ? '?' + qs : ''));
    },
    seriePeriodo: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/serie-periodo' + (qs ? '?' + qs : ''));
    },
    indicadores: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/indicadores' + (qs ? '?' + qs : ''));
    },
    desempenhoProdutos: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/desempenho-produtos' + (qs ? '?' + qs : ''));
    },
    contasProximasVencer: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/contas-proximas-vencer' + (qs ? '?' + qs : ''));
    },
    categorias: ()            => get('/financeiro/categorias'),
    despesasFixas: ()         => get('/financeiro/despesas-fixas'),
    criarCategoria: (data)    => post('/financeiro/categorias', data),
    criarDespesaFixa: (data)  => post('/financeiro/despesas-fixas', data),
    atualizarCategoria: (id, data) => put(`/financeiro/categorias/${id}`, data),
    atualizarDespesaFixa: (id, data) => put(`/financeiro/despesas-fixas/${id}`, data),
    excluirCategoria: (id)    => del(`/financeiro/categorias/${id}`),
    excluirDespesaFixa: (id)  => del(`/financeiro/despesas-fixas/${id}`),
    criar:      (data)        => post('/financeiro', data),
    atualizar:  (id, data)    => put(`/financeiro/${id}`, data),
    pagar:      (id)          => put(`/financeiro/${id}/pagar`),
    excluir:    (id)          => del(`/financeiro/${id}`),
  };

  return { auth, historico, produtos, clientes, fornecedores, locais, vendas, financeiro };
})();
