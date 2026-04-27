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
      const msg = data?.error?.message || data?.error || 'Erro na requisição';
      throw new Error(msg);
    }
    return data;
  }

  const get  = (path)        => request('GET',    path);
  const post = (path, body)  => request('POST',   path, body);
  const put  = (path, body)  => request('PUT',    path, body);
  const del  = (path)        => request('DELETE', path);

  // --- Produtos ---
  const produtos = {
    listar: ()           => get('/produtos'),
    obter:  (id)         => get(`/produtos/${id}`),
    criar:  (data)       => post('/produtos', data),
    atualizar: (id, data)=> put(`/produtos/${id}`, data),
    desativar: (id)      => del(`/produtos/${id}`),
    adicionarVariacao: (id, data) => post(`/produtos/${id}/variacoes`, data),
    desativarVariacao: (varId)    => del(`/produtos/variacoes/${varId}`),
    entradaEstoque: (varId, data) => post(`/produtos/variacoes/${varId}/estoque`, data),
  };

  // --- Clientes ---
  const clientes = {
    listar: ()            => get('/clientes'),
    obter:  (id)          => get(`/clientes/${id}`),
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

  // --- Vendas ---
  const vendas = {
    listar: ()      => get('/vendas'),
    obter:  (id)    => get(`/vendas/${id}`),
    criar:  (data)  => post('/vendas', data),
    cancelar: (id)  => put(`/vendas/${id}/cancelar`),
  };

  // --- Financeiro ---
  const financeiro = {
    listar: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro' + (qs ? '?' + qs : ''));
    },
    saldo:  ()            => get('/financeiro/saldo'),
    fluxo:  (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get('/financeiro/fluxo' + (qs ? '?' + qs : ''));
    },
    categorias: ()            => get('/financeiro/categorias'),
    criar:      (data)        => post('/financeiro', data),
    atualizar:  (id, data)    => put(`/financeiro/${id}`, data),
    pagar:      (id)          => put(`/financeiro/${id}/pagar`),
    excluir:    (id)          => del(`/financeiro/${id}`),
  };

  return { produtos, clientes, fornecedores, vendas, financeiro };
})();
