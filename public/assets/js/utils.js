/* utils.js — Formatação, máscaras e helpers */

const Utils = (() => {
  function moeda(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
  }

  function dataHora(str) {
    if (!str) return '—';
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function data(str) {
    if (!str) return '—';
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleDateString('pt-BR');
  }

  function hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function mascararTelefone(input) {
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '').slice(0, 11);
      if (v.length >= 7) {
        v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      } else if (v.length >= 3) {
        v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
      } else if (v.length >= 1) {
        v = v.replace(/^(\d{0,2})/, '($1');
      }
      input.value = v;
    });
  }

  function mascararCep(input) {
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      input.value = v;
    });
  }

  function whatsappLink(telefone) {
    if (!telefone) return null;
    const num = '55' + telefone.replace(/\D/g, '');
    return `https://wa.me/${num}`;
  }

  function formaPagamentoLabel(forma) {
    const map = {
      dinheiro: 'Dinheiro',
      debito: 'Débito',
      credito: 'Crédito',
      pix: 'Pix',
      misto: 'Misto'
    };
    return map[forma] || forma;
  }

  function margem(custo, preco) {
    if (!preco || preco === 0) return '0%';
    return (((preco - custo) / preco) * 100).toFixed(1) + '%';
  }

  return { moeda, dataHora, data, hoje, mascararTelefone, mascararCep, whatsappLink, formaPagamentoLabel, margem };
})();

/* --- Toast --- */
function toast(mensagem, tipo = 'info', duracao = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span>${icons[tipo] || 'ℹ️'}</span><span>${mensagem}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 320);
  }, duracao);
}

/* --- Modal --- */
const Modal = (() => {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const closeBtn = document.getElementById('modal-close');

  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function open(titulo, htmlContent) {
    titleEl.textContent = titulo;
    bodyEl.innerHTML = htmlContent;
    overlay.classList.remove('hidden');
  }

  function close() {
    overlay.classList.add('hidden');
    bodyEl.innerHTML = '';
  }

  function getBody() { return bodyEl; }

  // Modal de confirmação estilizado — retorna Promise<boolean>
  function confirm(mensagem, opcoes = {}) {
    const {
      titulo       = 'Confirmar ação',
      textoBotaoOk = 'Confirmar',
      tipoBotaoOk  = 'btn-danger',   // 'btn-danger' | 'btn-primary' | 'btn-success'
      icone        = '⚠️',
    } = opcoes;

    return new Promise((resolve) => {
      open(titulo, `
        <div style="text-align:center;padding:8px 0 20px">
          <div style="font-size:44px;margin-bottom:14px">${icone}</div>
          <p style="font-size:15px;color:var(--text);line-height:1.6">${mensagem}</p>
        </div>
        <div class="form-actions" style="justify-content:center;gap:12px">
          <button id="confirm-cancel" class="btn btn-outline" style="min-width:110px">Cancelar</button>
          <button id="confirm-ok"     class="${'btn ' + tipoBotaoOk}" style="min-width:110px">${textoBotaoOk}</button>
        </div>
      `);

      // Focar no botão cancelar por segurança
      setTimeout(() => document.getElementById('confirm-cancel')?.focus(), 50);

      document.getElementById('confirm-ok').addEventListener('click', () => {
        close(); resolve(true);
      });
      document.getElementById('confirm-cancel').addEventListener('click', () => {
        close(); resolve(false);
      });
    });
  }

  return { open, close, getBody, confirm };
})();
