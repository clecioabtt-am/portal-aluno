const formFaturas = document.getElementById('formFaturas');
const cpfInput = document.getElementById('cpf');
const mensagemFaturas = document.getElementById('mensagemFaturas');
const listaFaturas = document.getElementById('listaFaturas');

function somenteNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function formatarCPF(valor) {
  const cpf = somenteNumeros(valor).slice(0, 11);
  return cpf
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function moedaBR(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(dataISO) {
  if (!dataISO) return '-';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function escapeHTML(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBR(status) {
  const mapa = {
    PENDING: 'Aguardando pagamento',
    OVERDUE: 'Vencida',
    RECEIVED: 'Pago',
    CONFIRMED: 'Pago',
    RECEIVED_IN_CASH: 'Pago'
  };
  return mapa[status] || status || '-';
}

function statusClasse(status) {
  const mapa = {
    PENDING: 'statusPendente',
    OVERDUE: 'statusVencida',
    RECEIVED: 'statusPaga',
    CONFIRMED: 'statusPaga',
    RECEIVED_IN_CASH: 'statusPaga'
  };
  return mapa[status] || 'statusNeutro';
}

function formaPagamentoBR(tipo) {
  const valor = String(tipo || '').trim().toUpperCase();
  const mapa = {
    BOLETO: 'Boleto',
    PIX: 'Pix',
    CREDIT_CARD: 'Cartão de crédito',
    DEBIT_CARD: 'Cartão de débito',
    UNDEFINED: 'Não informada',
    '': 'Não informada'
  };
  return mapa[valor] || valor.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, letra => letra.toUpperCase());
}

function mostrarMensagem(texto, tipo = 'info') {
  mensagemFaturas.className = `mensagemFaturas ${tipo}`;
  mensagemFaturas.textContent = texto;
}

function categoriaDaFatura(status) {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) return 'pagas';
  if (status === 'OVERDUE') return 'vencidas';
  return 'aguardando';
}

function ordenarPorVencimento(faturas) {
  return [...faturas].sort((a, b) => String(b?.dueDate || '').localeCompare(String(a?.dueDate || '')));
}

function renderizarCardFatura(fatura) {
  const link = fatura.invoiceUrl || fatura.bankSlipUrl || fatura.paymentLink || '#';
  const descricao = escapeHTML(fatura.description || 'Mensalidade / Fatura escolar');
  const classeStatus = statusClasse(fatura.status);
  const textoBotao = categoriaDaFatura(fatura.status) === 'pagas' ? 'Ver fatura' : 'Pagar / acessar';
  const forma = formaPagamentoBR(fatura.billingType || fatura.paymentMethod || fatura.originalBillingType);

  return `
    <article class="faturaCard">
      <div class="faturaIcon">💳</div>
      <div class="faturaInfo">
        <h3>${descricao}</h3>
        <div class="faturaMeta">
          <span><b>Valor:</b> ${moedaBR(fatura.value)}</span>
          <span><b>Vencimento:</b> ${dataBR(fatura.dueDate)}</span>
          <span><b>Forma:</b> ${forma}</span>
          <span class="statusBadge ${classeStatus}"><b>Status:</b> ${statusBR(fatura.status)}</span>
        </div>
      </div>
      <a class="acessarFaturaBtn" href="${link}" target="_blank" rel="noopener">${textoBotao}</a>
    </article>`;
}

function renderizarFaturas(faturas) {
  listaFaturas.innerHTML = '';
  if (!faturas.length) {
    mostrarMensagem('Nenhuma fatura vencida, aguardando pagamento ou paga foi encontrada para esse aluno.', 'aviso');
    return;
  }

  const grupos = {
    pagas: ordenarPorVencimento(faturas.filter((fatura) => categoriaDaFatura(fatura.status) === 'pagas')),
    vencidas: ordenarPorVencimento(faturas.filter((fatura) => categoriaDaFatura(fatura.status) === 'vencidas')),
    aguardando: ordenarPorVencimento(faturas.filter((fatura) => categoriaDaFatura(fatura.status) === 'aguardando'))
  };

  const total = grupos.pagas.length + grupos.vencidas.length + grupos.aguardando.length;
  mostrarMensagem(`${total} fatura(s) encontrada(s). Escolha uma categoria abaixo.`, 'sucesso');

  const secoes = [
    { id: 'pagas', titulo: 'Faturas pagas', vazio: 'Nenhuma fatura paga encontrada.', classe: 'categoriaPagas' },
    { id: 'vencidas', titulo: 'Faturas vencidas', vazio: 'Nenhuma fatura vencida encontrada.', classe: 'categoriaVencidas' },
    { id: 'aguardando', titulo: 'Faturas aguardando pagamento', vazio: 'Nenhuma fatura aguardando pagamento encontrada.', classe: 'categoriaAguardando' }
  ];

  const categoriaInicial = grupos.vencidas.length ? 'vencidas' : (grupos.aguardando.length ? 'aguardando' : 'pagas');

  listaFaturas.innerHTML = `
    <div class="faturaCategorias" role="tablist" aria-label="Categorias de faturas">
      ${secoes.map((secao) => `
        <button type="button" class="categoriaFaturaBtn ${secao.classe} ${secao.id === categoriaInicial ? 'active' : ''}" data-categoria="${secao.id}" role="tab" aria-selected="${secao.id === categoriaInicial}">
          <span>${secao.titulo}</span>
          <strong>${grupos[secao.id].length}</strong>
        </button>
      `).join('')}
    </div>
    ${secoes.map((secao) => `
      <section class="faturaSecao ${secao.id === categoriaInicial ? 'active' : ''}" data-secao="${secao.id}">
        <div class="faturaSecaoHeader">
          <h2>${secao.titulo}</h2>
          <span>${grupos[secao.id].length} fatura(s)</span>
        </div>
        <div class="faturaSecaoLista">
          ${grupos[secao.id].length ? grupos[secao.id].map(renderizarCardFatura).join('') : `<p class="faturaVazia">${secao.vazio}</p>`}
        </div>
      </section>
    `).join('')}
  `;

  listaFaturas.querySelectorAll('.categoriaFaturaBtn').forEach((botao) => {
    botao.addEventListener('click', () => {
      const categoria = botao.dataset.categoria;
      listaFaturas.querySelectorAll('.categoriaFaturaBtn').forEach((item) => {
        const ativo = item.dataset.categoria === categoria;
        item.classList.toggle('active', ativo);
        item.setAttribute('aria-selected', String(ativo));
      });
      listaFaturas.querySelectorAll('.faturaSecao').forEach((secao) => {
        secao.classList.toggle('active', secao.dataset.secao === categoria);
      });
    });
  });
}

cpfInput?.addEventListener('input', (event) => {
  event.target.value = formatarCPF(event.target.value);
});

formFaturas?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nomeCompleto = document.getElementById('nomeCompleto').value.trim();
  const cpf = somenteNumeros(cpfInput.value);

  listaFaturas.innerHTML = '';
  if (nomeCompleto.length < 6) {
    mostrarMensagem('Digite o nome completo do aluno.', 'erro');
    return;
  }
  if (cpf.length !== 11) {
    mostrarMensagem('Digite um CPF válido com 11 números.', 'erro');
    return;
  }

  const botao = formFaturas.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Consultando...';
  mostrarMensagem('Consultando faturas no Asaas, aguarde...', 'info');

  try {
    const resposta = await fetch('/api/asaas-faturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeCompleto, cpf })
    });

    const texto = await resposta.text();
    let dados = {};
    try {
      dados = texto ? JSON.parse(texto) : {};
    } catch {
      throw new Error('A rota /api/asaas-faturas não retornou JSON. Verifique se as Functions do Cloudflare foram publicadas no deploy.');
    }

    if (!resposta.ok) throw new Error(dados.error || dados.detalhe || 'Não foi possível consultar as faturas.');
    renderizarFaturas(dados.faturas || []);
  } catch (erro) {
    mostrarMensagem(erro.message || 'Erro ao buscar faturas. Tente novamente.', 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = '🔎 Buscar faturas';
  }
});
