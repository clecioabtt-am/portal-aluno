function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function somenteNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function obterApiKey(env) {
  const chave = String(env?.ASAAS_API_KEY || '').trim();
  if (!chave) return '';
  return chave.replace(/^Bearer\s+/i, '').trim();
}

async function lerRespostaAsaas(resposta) {
  const texto = await resposta.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return { raw: texto.slice(0, 500) };
  }
}

async function chamarAsaas(env, caminho) {
  const baseUrl = String(env?.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '');
  const apiKey = obterApiKey(env);

  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'CEEB-Portal-Financeiro/1.0',
      'access_token': apiKey
    }
  });

  const dados = await lerRespostaAsaas(resposta);

  if (!resposta.ok) {
    const descricao = dados?.errors?.[0]?.description || dados?.message || dados?.error || `Asaas retornou HTTP ${resposta.status}`;
    throw new Error(descricao);
  }

  return dados;
}

async function buscarClientePorCpfENome(env, cpf, nomeCompleto) {
  const nomeNormalizado = normalizarTexto(nomeCompleto);
  const consultaCpf = await chamarAsaas(env, `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=100`);
  const clientesPorCpf = Array.isArray(consultaCpf?.data) ? consultaCpf.data : [];

  let cliente = clientesPorCpf.find((item) => somenteNumeros(item?.cpfCnpj) === cpf);

  if (!cliente) {
    const consultaNome = await chamarAsaas(env, `/customers?name=${encodeURIComponent(nomeCompleto)}&limit=100`);
    const clientesPorNome = Array.isArray(consultaNome?.data) ? consultaNome.data : [];
    cliente = clientesPorNome.find((item) => somenteNumeros(item?.cpfCnpj) === cpf);
  }

  if (!cliente) return null;

  const nomeCliente = normalizarTexto(cliente.name);
  const nomeConfere = nomeCliente === nomeNormalizado || nomeCliente.includes(nomeNormalizado) || nomeNormalizado.includes(nomeCliente);

  return nomeConfere ? cliente : null;
}

async function buscarFaturasAbertas(env, customerId) {
  const statuses = ['PENDING', 'OVERDUE'];
  const respostas = await Promise.all(
    statuses.map((status) => chamarAsaas(env, `/payments?customer=${encodeURIComponent(customerId)}&status=${status}&limit=100`))
  );

  const faturas = respostas
    .flatMap((resposta) => Array.isArray(resposta?.data) ? resposta.data : [])
    .filter((fatura) => ['PENDING', 'OVERDUE'].includes(fatura?.status))
    .sort((a, b) => String(a?.dueDate || '').localeCompare(String(b?.dueDate || '')))
    .map((fatura) => ({
      id: fatura.id,
      description: fatura.description || 'Mensalidade / Fatura escolar',
      value: fatura.value,
      dueDate: fatura.dueDate,
      status: fatura.status,
      billingType: fatura.billingType,
      invoiceUrl: fatura.invoiceUrl || '',
      bankSlipUrl: fatura.bankSlipUrl || '',
      paymentLink: fatura.invoiceUrl || fatura.bankSlipUrl || ''
    }));

  return faturas;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return json({ ok: true, rota: '/api/asaas-faturas', mensagem: 'API do financeiro publicada.' });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const apiKey = obterApiKey(env);
  if (!apiKey) {
    return json({ error: 'Chave API do Asaas não configurada. Cadastre ASAAS_API_KEY nas variáveis do Cloudflare Pages e faça novo deploy.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos. Envie nomeCompleto e cpf em JSON.' }, 400);
  }

  const nomeCompleto = String(body?.nomeCompleto || '').trim();
  const cpf = somenteNumeros(body?.cpf);

  if (nomeCompleto.length < 6 || cpf.length !== 11) {
    return json({ error: 'Informe o nome completo e um CPF válido com 11 números.' }, 400);
  }

  try {
    const cliente = await buscarClientePorCpfENome(env, cpf, nomeCompleto);

    if (!cliente) {
      return json({ clienteEncontrado: false, faturas: [], mensagem: 'Cliente não encontrado no Asaas com esse nome e CPF.' });
    }

    const faturas = await buscarFaturasAbertas(env, cliente.id);

    return json({
      clienteEncontrado: true,
      cliente: { id: cliente.id, name: cliente.name, cpfCnpj: cliente.cpfCnpj },
      faturas
    });
  } catch (erro) {
    return json({
      error: erro?.message || 'Erro ao consultar faturas no Asaas.',
      detalhe: 'Confira se a chave ASAAS_API_KEY pertence ao ambiente correto do Asaas e se o cliente possui CPF cadastrado.'
    }, 500);
  }
}
