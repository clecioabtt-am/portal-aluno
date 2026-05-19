function formatarNotaBR(v){
  if(v===null||v===undefined||v==='') return '-';
  const n = Number(v);
  if(Number.isNaN(n)) return v;
  return n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});}

const isSupabaseConfigured = () => {
  const url = String(window.CEEB_SUPABASE_URL || '').trim();
  const key = String(window.CEEB_SUPABASE_ANON_KEY || '').trim();
  return !!(url && key && !url.includes('SEU-PROJETO') && !key.includes('SUA_CHAVE') && /^https:\/\/[^\s]+\.supabase\.co\/?$/.test(url));
};

const supabaseClient = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Configure o arquivo config.js com a Project URL do Supabase no formato https://xxxxx.supabase.co e a anon public key.');
  }
  const url = String(window.CEEB_SUPABASE_URL).trim().replace(/\/$/, '');
  const key = String(window.CEEB_SUPABASE_ANON_KEY).trim();
  return window.supabase.createClient(url, key);
};
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const cleanCPF = (v='') => String(v).replace(/\D/g,'');
const norm = (v='') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const toNum = (v) => { if(v===undefined||v===null||v==='') return null; const n=parseFloat(String(v).replace(',','.').replace(/[^0-9.\-]/g,'')); return isNaN(n)?null:n; };
const setStatus = (el, msg, err=false) => { if(!el) return; el.textContent = msg; el.className = 'status' + (err?' error':''); el.classList.remove('hidden'); };

function extractMeta(text){
  const t = text.replace(/\s+/g,' ');
  const find = (labels) => {
    for(const label of labels){
      const r = new RegExp(label + '\\s*[:\\-]?\\s*([^|;\\n]+?)(?=\\s+(Professor|Disciplina|Hor[aá]rio|Carga|Turma|Per[ií]odo|Curso|Educa|$))','i');
      const m = t.match(r); if(m) return m[1].trim();
    }
    return '';
  };
  return {
    curso: find(['Educa[cç][aã]o Profissional','Curso']),
    turma: find(['Turma']), professor: find(['Professor\\(a\\)','Professor']),
    disciplina: find(['Disciplina']), horario: find(['Hor[aá]rio']),
    carga_horaria: find(['Carga Hor[aá]ria']), periodo: find(['Per[ií]odo'])
  };
}

function mapRows(rawRows){
  const rows = rawRows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [norm(k), v])));
  const out = [];
  for(const r of rows){
    const nome = r['nome'] || r['nomes'] || r['aluno'] || r['alunos'];
    if(!nome || String(nome).length < 5 || /nome/i.test(String(nome))) continue;
    out.push({
      nome: String(nome).trim(), cpf: cleanCPF(r['cpf'] || r['cpf/cnpj'] || ''),
      nota_1: toNum(r['1']||r['1°']||r['1º']||r['nota 1']||r['n1']),
      nota_2: toNum(r['2']||r['2°']||r['2º']||r['nota 2']||r['n2']),
      nota_3: toNum(r['3']||r['3°']||r['3º']||r['nota 3']||r['n3']),
      nota_4: toNum(r['4']||r['4°']||r['4º']||r['nota 4']||r['n4']),
      aproveitamento: toNum(r['aproveitamento']||r['média']||r['media']),
      faltas: toNum(r['faltas']) || 0,
      recuperacao: toNum(r['recuperação']||r['recuperacao']),
      media_pos_recuperacao: toNum(r['média pós recuperação']||r['media pos recuperacao']),
      situacao: r['sit'] || r['situação'] || r['situacao'] || '', observacao: ''
    });
  }
  return out;
}


function rowsFromMatrix(matrix){
  const cleanRow = (r) => (r || []).map(c => String(c ?? '').replace(/\s+/g,' ').trim());
  const rows = matrix.map(cleanRow).filter(r => r.some(Boolean));
  let headerIndex = rows.findIndex(r => r.some(c => ['nome','nomes','aluno','alunos'].includes(norm(c))));
  if(headerIndex < 0) headerIndex = rows.findIndex(r => r.some(c => /nomes?|alunos?/i.test(String(c))));
  if(headerIndex < 0) return [];
  const header = rows[headerIndex];
  const idx = (tests) => header.findIndex(h => tests.some(t => t.test(norm(h)) || t.test(String(h).toLowerCase())));
  const iNome = idx([/^nome$/, /^nomes$/, /^aluno/, /^alunos/]);
  const iCpf = idx([/^cpf/, /cpf\/cnpj/]);
  const findGrade = (n) => header.findIndex(h => {
    const x = norm(h).replace(/\s+/g,'');
    return x === String(n) || x === `${n}°` || x === `${n}º` || x === `${n}a` || x === `${n}ª` || x === `nota${n}` || x === `n${n}`;
  });
  const i1 = findGrade(1), i2 = findGrade(2), i3 = findGrade(3), i4 = findGrade(4);
  const iMedia = idx([/aproveitamento/, /^media$/, /^m[eé]dia$/]);
  const iFaltas = idx([/faltas?/]);
  const iRec = idx([/recupera/]);
  const iSit = idx([/^sit$/, /situacao/, /situa/]);
  const out=[];
  for(const row of rows.slice(headerIndex+1)){
    const nome = row[iNome] || '';
    if(!nome || nome.length < 5 || /total|m[eé]dia|nome|di[aá]rio|professor|disciplina/i.test(nome)) continue;
    const nums = row.map(toNum).filter(v => v !== null);
    out.push({
      nome: nome.trim(),
      cpf: cleanCPF(iCpf >= 0 ? row[iCpf] : ''),
      nota_1: i1 >= 0 ? toNum(row[i1]) : (nums[0] ?? null),
      nota_2: i2 >= 0 ? toNum(row[i2]) : (nums[1] ?? null),
      nota_3: i3 >= 0 ? toNum(row[i3]) : (nums[2] ?? null),
      nota_4: i4 >= 0 ? toNum(row[i4]) : (nums[3] ?? null),
      aproveitamento: iMedia >= 0 ? toNum(row[iMedia]) : (nums[4] ?? nums[3] ?? null),
      faltas: iFaltas >= 0 ? (toNum(row[iFaltas]) || 0) : 0,
      recuperacao: iRec >= 0 ? toNum(row[iRec]) : null,
      media_pos_recuperacao: null,
      situacao: iSit >= 0 ? row[iSit] : '',
      observacao: ''
    });
  }
  return out;
}

function alunosFromPlainText(text){
  const lines = String(text || '')
    .replace(/\u0000/g,' ')
    .split(/\r?\n|\u000b|\f/)
    .map(l => l.replace(/\s+/g,' ').trim())
    .filter(Boolean);
  const out=[];
  for(const line of lines){
    if(!/^\d{1,3}\s+/.test(line)) continue;
    const cpfMatch = line.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    const numericMatches = [...line.matchAll(/(?:^|\s)(\d{1,3}(?:[,.]\d{1,2})?)(?=\s|$)/g)].map(m=>m[1]);
    const withoutStart = line.replace(/^\d{1,3}\s+/, '');
    const firstGrade = withoutStart.search(/\s\d{1,2}[,.]\d{1,2}(?=\s|$)|\s\d{1,2}(?=\s+\d)/);
    if(firstGrade < 0) continue;
    let nome = withoutStart.slice(0, firstGrade).trim();
    nome = nome.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,'').trim();
    if(nome.length < 5 || /nome|professor|disciplina|horario|diario/i.test(nome)) continue;
    const gradePart = withoutStart.slice(firstGrade).trim();
    const vals = [...gradePart.matchAll(/\d{1,3}(?:[,.]\d{1,2})?/g)].map(m=>toNum(m[0])).filter(v=>v!==null);
    out.push({
      nome,
      cpf: cleanCPF(cpfMatch ? cpfMatch[0] : ''),
      nota_1: vals[0] ?? null,
      nota_2: vals[1] ?? null,
      nota_3: vals[2] ?? null,
      nota_4: vals[3] ?? null,
      aproveitamento: vals[4] ?? vals[3] ?? null,
      faltas: 0,
      recuperacao: null,
      media_pos_recuperacao: null,
      situacao: '',
      observacao: ''
    });
  }
  return out;
}


function decodeXmlEntities(text=''){
  return String(text)
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}

function extractDocxTextFromXml(xml=''){
  const paragraphs = [];
  const paraMatches = String(xml).match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  for(const p of paraMatches){
    const texts = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>decodeXmlEntities(m[1]));
    if(texts.length) paragraphs.push(texts.join('').replace(/\s+/g,' ').trim());
  }
  return paragraphs.filter(Boolean).join('\n');
}

function extractDocxTablesFromXml(xml=''){
  const tables = [];
  const tableMatches = String(xml).match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  for(const tbl of tableMatches){
    const matrix = [];
    const rowMatches = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    for(const tr of rowMatches){
      const cells = [];
      const cellMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      for(const tc of cellMatches){
        const texts = [...tc.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>decodeXmlEntities(m[1]));
        cells.push(texts.join(' ').replace(/\s+/g,' ').trim());
      }
      if(cells.some(Boolean)) matrix.push(cells);
    }
    if(matrix.length) tables.push(matrix);
  }
  return tables;
}

async function parseDocxRobusto(file){
  const buf = await file.arrayBuffer();
  let text = '';
  let alunos = [];

  // 1) Primeiro tenta pelo Mammoth, que lê bem documentos .docx comuns.
  if(window.mammoth){
    try{
      const html = await window.mammoth.convertToHtml({arrayBuffer:buf});
      const container = document.createElement('div');
      container.innerHTML = html.value || '';
      text = container.textContent || '';
      const tables = [...container.querySelectorAll('table')];
      for(const table of tables){
        const matrix = [...table.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g,' ').trim()));
        const found = rowsFromMatrix(matrix);
        if(found.length > alunos.length) alunos = found;
      }
      if(!alunos.length){
        const raw = await window.mammoth.extractRawText({arrayBuffer:buf});
        if(raw?.value && raw.value.length > text.length) text = raw.value;
      }
    }catch(e){ console.warn('Falha no Mammoth. Usando leitura interna do DOCX.', e); }
  }

  // 2) Fallback interno: abre o .docx como ZIP e lê word/document.xml.
  if(window.JSZip){
    try{
      const zip = await window.JSZip.loadAsync(buf);
      const doc = zip.file('word/document.xml');
      if(doc){
        const xml = await doc.async('string');
        const xmlTables = extractDocxTablesFromXml(xml);
        for(const matrix of xmlTables){
          const found = rowsFromMatrix(matrix);
          if(found.length > alunos.length) alunos = found;
        }
        const xmlText = extractDocxTextFromXml(xml);
        if(xmlText.length > text.length) text = xmlText;
      }
    }catch(e){ console.warn('Falha na leitura XML interna do DOCX.', e); }
  }

  if(!alunos.length) alunos = alunosFromPlainText(text);
  return {meta:extractMeta(text), alunos};
}

async function parseFile(file){
  const ext = file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].includes(ext)){
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    let allText = '';
    let alunos = [];
    for(const sheetName of wb.SheetNames){
      const sheet = wb.Sheets[sheetName];
      const arr = XLSX.utils.sheet_to_json(sheet, {header:1, defval:'', raw:false});
      allText += '\n' + arr.map(r=>r.join(' ')).join('\n');
      const found = rowsFromMatrix(arr);
      if(found.length > alunos.length) alunos = found;
    }
    if(!alunos.length) alunos = alunosFromPlainText(allText);
    return {meta:extractMeta(allText), alunos};
  }
  if(ext === 'docx'){
    return await parseDocxRobusto(file);
  }
  if(ext === 'doc' || ext === 'txt'){
    const buf = await file.arrayBuffer();
    const decoders = ['utf-8','windows-1252','utf-16le'];
    let text = '';
    for(const enc of decoders){
      try { const t = new TextDecoder(enc).decode(buf); if(t.length > text.length) text = t; } catch(e){}
    }
    const alunos = alunosFromPlainText(text);
    return {meta:extractMeta(text), alunos};
  }
  throw new Error('Formato não suportado. Envie .xlsx, .xls, .csv, .docx ou .doc. Se o Word for muito antigo ou for imagem escaneada, salve como Excel para leitura perfeita.');
}
function renderPreview(alunos){
  const tbody = $('#previewBody'); if(!tbody) return;
  tbody.innerHTML = alunos.length ? alunos.map((a,i)=>`<tr><td class="checkCol"><input class="studentSelect" type="checkbox" data-i="${i}" title="Selecionar aluno para excluir"></td><td>${i+1}</td><td><b>${a.nome}</b></td><td><input data-i="${i}" data-k="cpf" value="${a.cpf||''}" placeholder="CPF obrigatório"></td><td>${a.nota_1??''}</td><td>${a.nota_2??''}</td><td>${a.nota_3??''}</td><td>${a.aproveitamento??''}</td><td>${a.faltas??0}</td><td>${a.situacao||''}</td></tr>`).join('') : '<tr><td colspan="10">Nenhum aluno na prévia.</td></tr>';
  const selectAll = $('#selectAllPreview');
  if(selectAll) selectAll.checked = false;
}

async function initAdmin(){
  let sb = null;
  let parsed = null;
  let session = null;
  let currentDiarioId = null;

  const esc = (v='') => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const cpfMask = (v='') => cleanCPF(v).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
  const getUserId = () => session?.user?.id || null;
  const showPanel = (panelId) => {
    $$('.tabBtn,.panel').forEach(x=>x.classList.remove('active'));
    const btn = $(`.tabBtn[data-panel="${panelId}"]`);
    if(btn) btn.classList.add('active');
    const panel = $('#'+panelId);
    if(panel) panel.classList.add('active');
  };
  const showAdmin = (email) => {
    $('#loginArea')?.classList.add('hidden');
    $('#adminArea')?.classList.remove('hidden');
    const userEmail = $('#userEmail');
    if(userEmail) userEmail.textContent = email || '';
  };

  $$('.tabBtn').forEach(b=>b.onclick=()=>{
    showPanel(b.dataset.panel);
    if(b.dataset.panel === 'tabelasPanel') loadTables();
    if(b.dataset.panel === 'historicoPanel') loadImports();
  });

  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email')||'').trim().toLowerCase();
    const senha = String(fd.get('senha')||'').trim();
    if(!email || !senha) return setStatus($('#loginStatus'), 'Digite e-mail e senha.', true);
    try {
      sb = supabaseClient();
      const {error}=await sb.auth.signInWithPassword({email, password:senha});
      if(error) return setStatus($('#loginStatus'), 'Não foi possível fazer login. Confira se o usuário existe no Supabase Authentication e se o e-mail está confirmado.', true);
      location.reload();
    } catch(err) {
      return setStatus($('#loginStatus'), err.message || String(err), true);
    }
  });

  $('#logoutBtn')?.addEventListener('click', async()=>{
    try { if(isSupabaseConfigured()){ sb = sb || supabaseClient(); await sb.auth.signOut(); } } catch(e){}
    location.reload();
  });

  if(isSupabaseConfigured()){
    try { sb = supabaseClient(); const result = await sb.auth.getSession(); session = result?.data?.session || null; } catch(e){}
  }
  if(!session){ $('#loginArea')?.classList.remove('hidden'); $('#adminArea')?.classList.add('hidden'); return; }
  showAdmin(session?.user?.email || 'Coordenador');
  if(!sb) sb = supabaseClient();

  $('#fileInput')?.addEventListener('change', async e=>{
    try{ const file=e.target.files[0]; if(!file) return; setStatus($('#uploadStatus'),'Lendo arquivo e organizando as notas...'); parsed = await parseFile(file); parsed.fileName=file.name; Object.entries(parsed.meta).forEach(([k,v])=>{ const el=$(`[name="${k}"]`); if(el && v) el.value=v; }); renderPreview(parsed.alunos); setStatus($('#uploadStatus'),`Arquivo lido com sucesso. ${parsed.alunos.length} alunos encontrados. Preencha os CPFs que faltarem e clique em Salvar.`); }
    catch(err){ setStatus($('#uploadStatus'), err.message, true); }
  });
  $('#previewBody')?.addEventListener('input', e=>{ const i=e.target.dataset.i, k=e.target.dataset.k; if(parsed && i!==undefined && k) parsed.alunos[i][k]=e.target.value; });

  $('#deleteSelectedStudents')?.addEventListener('click', ()=>{
    if(!parsed || !parsed.alunos || !parsed.alunos.length) return setStatus($('#uploadStatus'), 'Nenhum aluno carregado para excluir.', true);
    const selected = $$('.studentSelect:checked').map(el=>Number(el.dataset.i)).filter(i=>!Number.isNaN(i));
    if(!selected.length) return setStatus($('#uploadStatus'), 'Selecione pelo menos um aluno para excluir da lista.', true);
    const selectedSet = new Set(selected);
    const removidos = parsed.alunos.filter((_,i)=>selectedSet.has(i)).map(a=>a.nome);
    parsed.alunos = parsed.alunos.filter((_,i)=>!selectedSet.has(i));
    renderPreview(parsed.alunos);
    setStatus($('#uploadStatus'), `${removidos.length} aluno(s) removido(s) da prévia: ${removidos.slice(0,3).join(', ')}${removidos.length>3?'...':''}`);
  });
  $('#selectAllPreview')?.addEventListener('change', e=>{ $$('.studentSelect').forEach(ch=>ch.checked = e.target.checked); });

  $('#saveImport')?.addEventListener('click', async()=>{
    try{
      if(!parsed || !parsed.alunos.length) throw new Error('Envie um arquivo antes de salvar.');
      const meta = Object.fromEntries(new FormData($('#metaForm')).entries());
      if(!meta.disciplina || !meta.turma) throw new Error('Informe pelo menos disciplina e turma.');
      const semCpf = parsed.alunos.filter(a=>cleanCPF(a.cpf).length<11); if(semCpf.length) throw new Error(`Existem ${semCpf.length} alunos sem CPF. Preencha o CPF para o aluno conseguir consultar.`);
      if(!sb) sb = supabaseClient();
      const coordenador_id = getUserId();
      if(!coordenador_id) throw new Error('Sessão do coordenador não encontrada. Saia e entre novamente.');
      setStatus($('#saveStatus'),'Salvando alunos e notas no Supabase...');
      const {data:diario,error:de}=await sb.from('diarios_ceeb').insert({...meta,coordenador_id,nome_arquivo:parsed.fileName,total_alunos:parsed.alunos.length}).select().single(); if(de) throw de;
      for(const a of parsed.alunos){
        const cpf=cleanCPF(a.cpf);
        let {data:aluno,error:ae}=await sb.from('alunos_ceeb').upsert({nome:a.nome,nome_normalizado:norm(a.nome),cpf,coordenador_id},{onConflict:'coordenador_id,cpf'}).select().single(); if(ae) throw ae;
        const nota = {
          diario_id: diario.id,
          aluno_id: aluno.id,
          coordenador_id,
          curso: meta.curso || null,
          turma: meta.turma || null,
          professor: meta.professor || null,
          disciplina: meta.disciplina || null,
          horario: meta.horario || null,
          carga_horaria: meta.carga_horaria || null,
          periodo: meta.periodo || null,
          nota_1: a.nota_1 ?? null,
          nota_2: a.nota_2 ?? null,
          nota_3: a.nota_3 ?? null,
          nota_4: a.nota_4 ?? null,
          aproveitamento: a.aproveitamento ?? null,
          faltas: a.faltas ?? 0,
          recuperacao: a.recuperacao ?? null,
          media_pos_recuperacao: a.media_pos_recuperacao ?? null,
          situacao: a.situacao || null,
          observacao: a.observacao || null
        };
        const {error:ne}=await sb.from('notas_ceeb').upsert(nota,{onConflict:'aluno_id,disciplina,turma,periodo,coordenador_id'}); if(ne) throw ne;
      }
      setStatus($('#saveStatus'),'Notas salvas com sucesso! A tabela ficou vinculada ao coordenador logado.');
      await loadTables(); await loadImports();
    }catch(err){
      let msg = err.message || String(err);
      if(msg.includes('schema cache') || msg.includes('coordenador_id') || msg.includes('there is no unique') || msg.includes('notas_ceeb')){
        msg = 'O banco ainda precisa da migração de coordenadores. Execute o arquivo SUPABASE_COORDENADORES_RLS.sql no SQL Editor do Supabase e depois tente novamente.';
      }
      setStatus($('#saveStatus'), msg, true);
    }
  });

  async function loadTables(){
    if(!sb) sb = supabaseClient();
    const userId = getUserId();
    const tbody = $('#tablesBody');
    if(!tbody || !userId) return;
    const {data,error}=await sb.from('diarios_ceeb').select('*').eq('coordenador_id',userId).order('created_at',{ascending:false});
    if(error){ tbody.innerHTML=`<tr><td colspan="7">Erro ao carregar tabelas: ${esc(error.message)}</td></tr>`; return; }
    tbody.innerHTML=(data||[]).length ? data.map(d=>`<tr><td>${new Date(d.created_at).toLocaleString('pt-BR')}</td><td><b>${esc(d.disciplina||'-')}</b></td><td>${esc(d.turma||'-')}</td><td>${esc(d.professor||'-')}</td><td>${d.total_alunos||0}</td><td>${esc(d.nome_arquivo||'')}</td><td><button class="outline" data-open="${d.id}">Abrir</button> <button class="outline danger" data-del="${d.id}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="7">Nenhuma tabela enviada por este coordenador ainda.</td></tr>';
  }

  $('#tablesBody')?.addEventListener('click', async e=>{
    const openId = e.target?.dataset?.open;
    const delId = e.target?.dataset?.del;
    if(openId) return openTable(openId);
    if(delId) return deleteTable(delId);
  });

  async function deleteTable(diarioId){
    if(!confirm('Tem certeza que deseja excluir esta tabela? As notas vinculadas a ela serão removidas do banco.')) return;
    try{
      setStatus($('#tablesStatus'),'Excluindo tabela...');
      const {error}=await sb.from('diarios_ceeb').delete().eq('id',diarioId).eq('coordenador_id',getUserId());
      if(error) throw error;
      setStatus($('#tablesStatus'),'Tabela excluída com sucesso.');
      await loadTables(); await loadImports();
    }catch(err){ setStatus($('#tablesStatus'), err.message || String(err), true); }
  }

  async function openTable(diarioId){
    try{
      currentDiarioId = diarioId;
      setStatus($('#editorStatus'),'Carregando alunos da tabela...');
      const {data:diario,error:de}=await sb.from('diarios_ceeb').select('*').eq('id',diarioId).eq('coordenador_id',getUserId()).single();
      if(de) throw de;
      const {data:notas,error:ne}=await sb.from('notas_ceeb').select('id, aluno_id, disciplina, turma, situacao, alunos_ceeb(id,nome,cpf)').eq('diario_id',diarioId).eq('coordenador_id',getUserId()).order('disciplina');
      if(ne) throw ne;
      $('#editorTitle').textContent = `Editar tabela: ${diario.disciplina || diario.nome_arquivo || 'Sem nome'}`;
      $('#editorSubtitle').textContent = `${diario.turma || '-'} • ${diario.professor || '-'} • ${notas?.length || 0} aluno(s)`;
      renderEditor(notas||[]);
      $('#editorStatus')?.classList.add('hidden');
      showPanel('editorPanel');
    }catch(err){ setStatus($('#tablesStatus'), err.message || String(err), true); }
  }

  function renderEditor(notas){
    const tbody = $('#editorBody'); if(!tbody) return;
    tbody.innerHTML = notas.length ? notas.map(n=>{
      const a = n.alunos_ceeb || {};
      return `<tr data-nota="${n.id}" data-aluno="${a.id||''}"><td><input data-k="nome" value="${esc(a.nome||'')}"></td><td><input data-k="cpf" value="${esc(cpfMask(a.cpf||''))}"></td><td>${esc(n.disciplina||'-')}</td><td>${esc(n.turma||'-')}</td><td>${esc(n.situacao||'-')}</td><td><button class="outline" data-save-row="${n.id}">Salvar</button> <button class="outline danger" data-delete-row="${n.id}">Excluir aluno</button></td></tr>`;
    }).join('') : '<tr><td colspan="6">Nenhum aluno nesta tabela.</td></tr>';
  }

  $('#editorBody')?.addEventListener('click', async e=>{
    const saveId = e.target?.dataset?.saveRow;
    const deleteId = e.target?.dataset?.deleteRow;
    if(saveId) return saveStudentRow(saveId);
    if(deleteId) return deleteStudentRow(deleteId);
  });
  $('#backToTables')?.addEventListener('click', async()=>{ await loadTables(); showPanel('tabelasPanel'); });

  async function saveStudentRow(notaId){
    try{
      const tr = $(`tr[data-nota="${notaId}"]`);
      const alunoId = tr?.dataset?.aluno;
      if(!tr || !alunoId) throw new Error('Aluno não encontrado nesta linha.');
      const nome = tr.querySelector('[data-k="nome"]')?.value?.trim();
      const cpf = cleanCPF(tr.querySelector('[data-k="cpf"]')?.value || '');
      if(!nome || cpf.length < 11) throw new Error('Informe nome completo e CPF válido.');
      setStatus($('#editorStatus'),'Salvando alteração do aluno...');
      const {error}=await sb.from('alunos_ceeb').update({nome,nome_normalizado:norm(nome),cpf}).eq('id',alunoId).eq('coordenador_id',getUserId());
      if(error) throw error;
      setStatus($('#editorStatus'),'Aluno atualizado com sucesso.');
      if(currentDiarioId) await openTable(currentDiarioId);
    }catch(err){ setStatus($('#editorStatus'), err.message || String(err), true); }
  }

  async function deleteStudentRow(notaId){
    if(!confirm('Deseja excluir este aluno desta tabela?')) return;
    try{
      setStatus($('#editorStatus'),'Excluindo aluno desta tabela...');
      const {error}=await sb.from('notas_ceeb').delete().eq('id',notaId).eq('coordenador_id',getUserId());
      if(error) throw error;
      setStatus($('#editorStatus'),'Aluno removido da tabela.');
      if(currentDiarioId) await openTable(currentDiarioId);
      await loadTables(); await loadImports();
    }catch(err){ setStatus($('#editorStatus'), err.message || String(err), true); }
  }

  async function loadImports(){
    if(!isSupabaseConfigured()) return;
    if(!sb) sb = supabaseClient();
    const userId = getUserId();
    if(!userId) return;
    const {data,error}=await sb.from('diarios_ceeb').select('*').eq('coordenador_id',userId).order('created_at',{ascending:false}).limit(50);
    if(error) return;
    $('#importsBody').innerHTML=(data||[]).map(d=>`<tr><td>${new Date(d.created_at).toLocaleString('pt-BR')}</td><td><b>${esc(d.disciplina||'-')}</b></td><td>${esc(d.turma||'-')}</td><td>${esc(d.professor||'-')}</td><td>${d.total_alunos||0}</td><td>${esc(d.nome_arquivo||'')}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma importação encontrada.</td></tr>';
  }

  await loadTables();
  await loadImports();
}

async function initAluno(){
  let sb;
  try { sb = supabaseClient(); } catch(err) { setStatus($('#consultaStatus'), err.message || String(err), true); return; }
  $('#consultaForm')?.addEventListener('submit', async e=>{
    e.preventDefault(); const fd=new FormData(e.target); const nome=norm(fd.get('nome')); const cpf=cleanCPF(fd.get('cpf'));
    try{ if(!nome || cpf.length<11) throw new Error('Digite seu nome e CPF completo.'); setStatus($('#consultaStatus'),'Buscando suas notas...');
      const {data:alunos,error:ae}=await sb.from('alunos_ceeb').select('id,nome,cpf').eq('cpf',cpf); if(ae) throw ae;
      const aluno=(alunos||[]).find(a=>norm(a.nome).includes(nome)||nome.includes(norm(a.nome))); if(!aluno) throw new Error('Aluno não encontrado. Confira nome e CPF ou fale com a coordenação.');
      const {data:notas,error:ne}=await sb.from('notas_ceeb').select('*').eq('aluno_id',aluno.id).order('disciplina'); if(ne) throw ne;
      renderBoletim(aluno, notas||[]); $('#consultaStatus').classList.add('hidden');
    }catch(err){ setStatus($('#consultaStatus'), err.message || String(err), true); $('#resultado').classList.add('hidden'); }
  });
}
function renderBoletim(aluno, notas){
  const r=$('#resultado'); r.classList.remove('hidden');
  r.innerHTML=`<div class="card"><div class="boletimTop"><div><h2>Boletim Digital</h2><p><b>Aluno:</b> ${aluno.nome}<br><b>CPF:</b> ${aluno.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}</p></div><div><button class="btn noPrint" onclick="window.print()">Imprimir / Salvar PDF</button></div></div></div>${notas.length?notas.map(n=>`<article class="subjectCard"><h3>${n.disciplina||'Disciplina'} <span class="pill">${n.situacao||'Lançada'}</span></h3><p><b>Curso:</b> ${n.curso||'-'} &nbsp; <b>Turma:</b> ${n.turma||'-'}<br><b>Professor:</b> ${n.professor||'-'}<br><b>Horário:</b> ${n.horario||'-'} &nbsp; <b>Carga horária:</b> ${n.carga_horaria||'-'} &nbsp; <b>Período:</b> ${n.periodo||'-'}</p><div class="tableWrap"><table><thead><tr><th>1ª</th><th>2ª</th><th>3ª</th><th>4ª</th><th>Média</th><th>Faltas</th><th>Recuperação</th><th>Média pós rec.</th></tr></thead><tbody><tr><td class="grade">${n.nota_1??'-'}</td><td class="grade">${n.nota_2??'-'}</td><td class="grade">${n.nota_3??'-'}</td><td class="grade">${n.nota_4??'-'}</td><td class="grade">${n.aproveitamento??'-'}</td><td>${n.faltas??0}</td><td>${n.recuperacao??'-'}</td><td>${n.media_pos_recuperacao??'-'}</td></tr></tbody></table></div></article>`).join(''):'<div class="card"><p>Nenhuma nota lançada para este aluno ainda.</p></div>'}`;
}
