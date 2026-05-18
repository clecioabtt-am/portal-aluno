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

