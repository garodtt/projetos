# Gestão de Projetos

Sistema de organização de projetos com atividades, quadro kanban e diagramas visuais (draw.io), usando Supabase como banco de dados.

## Rodando localmente

1. `npm install`
2. `env` e preencha com as credenciais do seu projeto Supabase (Settings → API)
3. `npm run dev`
4. Acesse o endereço que aparecer no terminal (geralmente http://localhost:5173)

## Build de produção

`npm run build` gera a pasta `dist/`, que é o que a Netlify publica.

## Banco de dados

As tabelas do Supabase não mudam neste projeto — use o SQL já criado nas etapas anteriores (`projects`, `activities`, `kanban_columns`, `versions`, `diagrams`).