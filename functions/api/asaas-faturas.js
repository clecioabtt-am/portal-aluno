function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
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

async function chamarAsaas(env, caminho) {
  const baseUrl = env.ASAAS_API_URL || 'https://api.asaas.com/v3';
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      access_token: env.ASAAS_API_KEY
    }
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados?.errors?.[0]?.description || 'Erro na comunicação com o Asaas.');
  }
  return dados;
}

export async function onRequestPost({ request, env }) {
  if (!env.ASAAS_API_KEY) {
    return json({ error: 'Chave API do Asaas não configurada no Cloudflare Pages.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos.' }, 400);
  }

  const nomeCompleto = String(body.nomeCompleto || '').trim();
  const cpf = somenteNumeros(body.cpf);

  if (nomeCompleto.length < 6 || cpf.length !== 11) {
    return json({ error: 'Informe nome completo e CPF válido.' }, 400);
  }

  try {
    const clientes = await chamarAsaas(env, `/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=20`);
    const nomeNormalizado = normalizarTexto(nomeCompleto);
    const cliente = (clientes.data || []).find((item) => {
      const cpfCliente = somenteNumeros(item.cpfCnpj);
      const nomeCliente = normalizarTexto(item.name);
      return cpfCliente === cpf && (nomeCliente === nomeNormalizado || nomeCliente.includes(nomeNormalizado) || nomeNormalizado.includes(nomeCliente));
    });

    if (!cliente) {
      return json({ clienteEncontrado: false, faturas: [] });
    }

    const [pendentes, vencidas] = await Promise.all([
      chamarAsaas(env, `/payments?customer=${encodeURIComponent(cliente.id)}&status=PENDING&limit=100`),
      chamarAsaas(env, `/payments?customer=${encodeURIComponent(cliente.id)}&status=OVERDUE&limit=100`)
    ]);

    const faturas = [...(pendentes.data || []), ...(vencidas.data || [])]
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
      .map((fatura) => ({
        id: fatura.id,
        description: fatura.description,
        value: fatura.value,
        dueDate: fatura.dueDate,
        status: fatura.status,
        billingType: fatura.billingType,
        invoiceUrl: fatura.invoiceUrl,
        bankSlipUrl: fatura.bankSlipUrl,
        paymentLink: fatura.invoiceUrl || fatura.bankSlipUrl
      }));

    return json({ clienteEncontrado: true, cliente: { id: cliente.id, name: cliente.name }, faturas });
  } catch (erro) {
    return json({ error: erro.message || 'Erro ao consultar faturas no Asaas.' }, 502);
  }
}

export async function onRequestGet() {
  return json({ error: 'Método não permitido.' }, 405);
}
