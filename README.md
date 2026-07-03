# Gestão de Projetos

Sistema web para organizar projetos de desenvolvimento (freelancer ou equipe pequena atendendo clientes): reuniões, solicitações de melhoria/correção, quadro Kanban de tarefas e um painel visual livre para diagramas, notas e arquivos.

## Funcionalidades

- **Projetos organizados em pastas** — agrupe projetos relacionados (ex: um cliente com várias frentes) na barra lateral, com indicador de pendências por pasta e por projeto.
- **Atividades** — registre reuniões (quem participou, o que foi falado), melhorias e correções solicitadas por clientes, com anexos de qualquer tipo de arquivo (imagem, PDF, Word, Excel, PowerPoint). Melhorias e correções viram automaticamente um card no quadro de tarefas.
- **Quadro Kanban (Tarefas)** — colunas totalmente editáveis (nome, cor dos cards daquela coluna, se ela conta como "pendência" na barra lateral), cards com prioridade, anexos múltiplos, arrastar-e-soltar entre colunas e dentro da mesma coluna.
- **Painel livre** — quadro estilo Miro dentro de cada projeto: diagramas (editor completo do draw.io), notas tipo post-it e arquivos, todos arrastáveis, redimensionáveis e com controle de camada (frente/trás).
- **Exclusão segura de projeto** — remove projeto e tudo dentro dele (atividades, tarefas, painel, anexos), com confirmação por digitação do nome.

## Tecnologias

- [React](https://react.dev/) 18 + [Vite](https://vitejs.dev/) 5
- [Supabase](https://supabase.com/) (Postgres + Storage) como backend
- [draw.io / diagrams.net](https://www.diagrams.net/) embutido via iframe para os diagramas
- CSS puro (sem framework de estilos)

## Estrutura de pastas
gestao-projetos/
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── .gitignore
├── .env.example
├── README.md
├── supabase/
│   └── schema.sql
└── src/
  ├── main.jsx
├── App.jsx
├── App.css
├── index.css
├── constants.js
├── lib/
│   └── supabaseClient.js
├── utils/
│   ├── format.js
│   └── files.js
└── components/
├── Sidebar.jsx
        ├── ProjectModal.jsx
├── Spinner.jsx
├── Toast.jsx
      ├── AttachmentsField.jsx
├── activities/
│   ├── ActivitiesTab.jsx
│   └── ActivityModal.jsx
└── tasks/
         ├── TasksTab.jsx
├── KanbanBoard.jsx
├── ColumnSettingsModal.jsx
├── VersionModal.jsx
├── PanelSection.jsx
└── DiagramModal.jsx

## Instalação (ambiente novo, do zero)

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior)
- Uma conta no [Supabase](https://supabase.com/)

### 2. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

### 3. Criar e configurar o projeto no Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com/).
2. Vá em **SQL Editor** → cole o conteúdo completo de `supabase/schema.sql` → **Run**.
3. Confira em **Storage** se o bucket `attachments` foi criado.
4. Vá em **Settings → API** e copie a **Project URL** e a chave **anon public**.

### 4. Configurar variáveis de ambiente

O `.env` já está no `.gitignore` — não é enviado ao Git.

### 5. Rodar localmente

```bash
npm run dev
```

Acesse o endereço mostrado no terminal (geralmente `http://localhost:5173`).

## Deploy em produção (Netlify)

1. Suba o projeto para um repositório no GitHub (o `.env` não vai junto, por design).
2. Na Netlify: **Add new site → Import from Git** → selecione o repositório.
3. Build command: `npm run build` — Publish directory: `dist` (já configurado em `netlify.toml`).
4. Em **Site settings → Environment variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores reais.
5. Faça o deploy (ou redeploy, se as variáveis foram adicionadas depois do primeiro build).

## Segurança — leia antes de compartilhar o link publicamente

- A chave **anon** do Supabase é feita para ficar exposta no navegador — isso é esperado e normal, não é uma falha.
- O que protege os dados de verdade são as políticas de **Row Level Security (RLS)**. Neste projeto, elas estão configuradas como `using (true) with check (true)` em todas as tabelas — ou seja, **qualquer pessoa com o link consegue ler, criar, editar e apagar tudo, sem login**. Isso é aceitável para uso pessoal/interno com o link não divulgado, mas antes de compartilhar amplamente, vale implementar autenticação (Supabase Auth) e travar as políticas por usuário.
- Arquivos enviados (Storage) não são apagados automaticamente quando o registro que os referencia é excluído — eles continuam ocupando espaço no bucket `attachments`.

## Manual de uso

### Projetos e pastas

- **+ Novo Projeto** (barra lateral): cria um projeto com nome, descrição, objetivos e escopo.
- **+ Nova Pasta**: cria um agrupador. Clique na pasta para expandir/recolher os projetos dentro dela.
- Para mover um projeto para uma pasta (ou tirar de uma), abra o projeto → botão **📄 Resumo** → campo **Pasta**.
- Um número vermelho ao lado do nome do projeto (ou da pasta) indica quantos itens estão numa coluna marcada como "indicador" no quadro de tarefas (por padrão, a coluna "Não atribuídos").
- Para excluir um projeto: **📄 Resumo** → **Excluir projeto** → digite o nome exato do projeto para confirmar. Isso apaga tudo dentro dele e não pode ser desfeito.

### Atividades

- **+ Nova Atividade**: escolha o tipo (Reunião, Melhoria ou Correção), preencha nome, data e descrição, e anexe arquivos se precisar.
- **Melhoria** e **Correção** criam automaticamente um card na coluna "Não atribuídos" do quadro de Tarefas, com prioridade "Urgente" para correções.
- Clique em qualquer card da lista para editar ou excluir.
- Use os filtros (Todos / Reuniões / Melhorias / Correções) para focar num tipo específico.

### Tarefas (quadro Kanban)

- **+ Nova Coluna**: cria uma coluna no quadro.
- Clique no **nome de uma coluna** para configurá-la: renomear, marcar como "indicador" (aparece na barra lateral) e escolher uma cor para a borda dos cards daquela coluna.
- Use as setas **←** / **→** no cabeçalho da coluna para reordená-las.
- Arraste os cards para mover entre colunas ou reordenar dentro da mesma coluna.
- Cada card tem versão, solicitante, data, prioridade, descrição e anexos.

### Painel

- **+ Criar anotação**: escolha entre **Diagrama** (abre o editor visual do draw.io), **Nota** (post-it editável) ou **Arquivo** (qualquer tipo).
- Arraste os itens pela alcinha (⠿) no topo de cada um.
- Notas e arquivos podem ser redimensionados pelo cantinho inferior direito.
- Use **▲** (trazer para frente) e **▼** (enviar para trás) para controlar sobreposição entre itens.
- Diagramas abrem em modo de visualização com zoom; clique em **Editar** para reabrir o canvas do draw.io.

### Anexos

- Disponíveis em atividades e em cards de tarefas, aceitando imagem, PDF, Word, Excel, PowerPoint e formatos equivalentes.
- Um item pode ter **vários anexos** — todos aparecem listados dentro do modal, cada um com nome e botão de remover.
- Na lista, um único anexo mostra preview (se imagem) ou link; dois ou mais mostram um resumo "📎 N anexos".

## Limitações conhecidas

- Sem autenticação — veja a seção Segurança acima.
- Criar/renomear coluna e criar/renomear pasta ainda usam `prompt()`/`confirm()` nativos do navegador, que não funcionam dentro de alguns visualizadores embutidos (ex: painel "Simple Browser" do VS Code). Funciona normalmente numa aba de navegador comum (Chrome, Edge, Firefox).
- Arquivos removidos de um item continuam existindo no Storage do Supabase (não há limpeza automática).
