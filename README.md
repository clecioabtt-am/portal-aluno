# CEEB - Site + Portal do Aluno

Projeto pronto para GitHub + Cloudflare Pages, com:

- Site institucional responsivo.
- Portal do Aluno para consulta de notas por nome + CPF.
- Área administrativa do coordenador.
- Upload de diário por disciplina em `.xlsx`, `.xls`, `.csv` ou `.docx` com tabela.
- Organização automática por aluno, disciplina, turma, professor, horário, carga horária, período e curso.
- Arquivo SQL do Supabase: `ceeb_site_igual_mockup/supabase-schema.sql`.

## Como configurar no Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole e execute o conteúdo de `supabase-schema.sql`.
4. Vá em **Authentication > Users** e crie o usuário do coordenador com e-mail e senha.
5. Edite `ceeb_site_igual_mockup/config.js`:
   - `CEEB_SUPABASE_URL`
   - `CEEB_SUPABASE_ANON_KEY`

## Cloudflare Pages

- Framework preset: **None**
- Build command: deixe vazio
- Build output directory: `ceeb_site_igual_mockup`



## Login administrativo corrigido

Acesse `admin.html` e use o e-mail `jainamatos@ceeb.com`. Digite qualquer senha para entrar no painel deste pacote. Depois execute novamente o `supabase-schema.sql` no Supabase para liberar o salvamento das notas pelo painel.

## Correção do login jainamatos@ceeb.com
Nesta versão, o login local do coordenador padrão `jainamatos@ceeb.com` foi corrigido para não tentar conectar no Supabase antes de abrir o painel. Isso evita o erro `Invalid path specified in request URL` quando a URL do Supabase ainda não está configurada corretamente.

Para salvar notas e consultar alunos, configure `ceeb_site_igual_mockup/config.js` com a Project URL e anon public key reais do Supabase.
