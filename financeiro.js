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

function statusBR(status) {
  const mapa = {
    PENDING: 'Aguardando pagamento',
    OVERDUE: 'Vencida',
    RECEIVED: 'Recebida',
    CONFIRMED: 'Confirmada',
    REFUNDED: 'Estornada',
    CANCELLED: 'Cancelada'
  };
  return mapa[status] || status || '-';
}

function mostrarMensagem(texto, tipo = 'info') {
  mensagemFaturas.className = `mensagemFaturas ${tipo}`;
  mensagemFaturas.textContent = texto;
}

function renderizarFaturas(faturas) {
  listaFaturas.innerHTML = '';
  if (!faturas.length) {
    mostrarMensagem('Nenhuma fatura aguardando pagamento foi encontrada para esse aluno.', 'aviso');
    return;
  }

  mostrarMensagem(`${faturas.length} fatura(s) encontrada(s).`, 'sucesso');
  listaFaturas.innerHTML = faturas.map((fatura) => {
    const link = fatura.invoiceUrl || fatura.bankSlipUrl || fatura.paymentLink || '#';
    const descricao = fatura.description || 'Mensalidade / Fatura escolar';
    return `
      <article class="faturaCard">
        <div class="faturaIcon">💳</div>
        <div class="faturaInfo">
          <h3>${descricao}</h3>
          <div class="faturaMeta">
            <span><b>Valor:</b> ${moedaBR(fatura.value)}</span>
            <span><b>Vencimento:</b> ${dataBR(fatura.dueDate)}</span>
            <span><b>Status:</b> ${statusBR(fatura.status)}</span>
            <span><b>Forma:</b> ${fatura.billingType || '-'}</span>
          </div>
        </div>
        <a class="acessarFaturaBtn" href="${link}" target="_blank" rel="noopener">Acessar o link</a>
      </article>`;
  }).join('');
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
