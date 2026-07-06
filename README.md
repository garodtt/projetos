# Gestão de Projetos

Sistema web para organizar projetos de desenvolvimento (freelancer ou equipe pequena atendendo clientes): reuniões, solicitações de melhoria/correção, quadro Kanban de tarefas, painel visual livre, cronograma estilo Gantt e controle de versionamento por projeto.

## Funcionalidades

- **Projetos organizados em pastas** — agrupe projetos relacionados (ex: um cliente com várias frentes) na barra lateral, com indicador de pendências por pasta e por projeto.
- **Atividades** — registre reuniões (quem participou, o que foi falado), melhorias e correções solicitadas por clientes, com título, complexidade, prioridade e anexos de qualquer tipo de arquivo. Melhorias e correções viram automaticamente um card no quadro de tarefas. Exporte a agenda de reuniões em PDF.
- **Quadro Kanban (Tarefas)** — colunas totalmente editáveis (nome, indicador na lateral, cor dos cards, coluna de versão), cards com título, prioridade, complexidade, anexos múltiplos, arrastar-e-soltar entre colunas e dentro da mesma coluna.
- **Painel livre** — quadro estilo Miro dentro de cada projeto: diagramas (editor completo do draw.io, com exportação em PNG/SVG), notas com editor de texto rico (negrito, itálico, listas, checklist, grifar) e arquivos de qualquer tipo — todos arrastáveis, redimensionáveis e com controle de camada.
- **Cronograma** — tabela estilo MS Project (nome com hierarquia/WBS, duração, início, término calculado automaticamente, predecessoras, recursos, cor da barra) sincronizada com um gráfico de Gantt construído sob medida, com zoom por dia/semana/mês.
- **Cronograma Geral e por pasta** — visão combinada, somente leitura, de todas as tarefas de cronograma de vários projetos numa linha do tempo só, com tag colorida por projeto.
- **Versionamento por projeto** — cada projeto tem uma versão (major.minor.patch). Configure quantos itens de cada complexidade (grande/média/mínima) são necessários para subir cada posição do número, marque uma coluna do quadro como "coluna de versão", e a versão sobe automaticamente quando itens caem lá — com histórico permanente de quais itens compuseram cada subida.
- **Exclusão segura de projeto** — remove projeto e tudo dentro dele (atividades, tarefas, painel, cronograma, versionamento, anexos), com confirmação por digitação do nome.

## Tecnologias

- [React](https://react.dev/) 18 + [Vite](https://vitejs.dev/) 5
- [Supabase](https://supabase.com/) (Postgres + Storage) como backend
- [draw.io / diagrams.net](https://www.diagrams.net/) embutido via iframe para os diagramas do Painel
- [jsPDF](https://github.com/parallax/jsPDF) para exportar a agenda de reuniões em PDF
- Editor de texto rico das notas feito com `document.execCommand` (recurso nativo do navegador)
- Gráfico de Gantt do Cronograma construído sob medida (sem biblioteca externa)
- CSS puro (sem framework de estilos)

## 📁 Estrutura do Projeto

```text
gestao-projetos/
├── .env.example
├── .gitignore
├── index.html
├── netlify.toml
├── package.json
├── README.md
├── vite.config.js
├── supabase/
│   └── schema.sql
└── src/
    ├── App.css
    ├── App.jsx
    ├── constants.js
    ├── index.css
    ├── main.jsx
    ├── components/
    │   ├── AttachmentsField.jsx
    │   ├── ProjectModal.jsx
    │   ├── ProjectVersionModal.jsx
    │   ├── RichTextEditor.jsx
    │   ├── Sidebar.jsx
    │   ├── Spinner.jsx
    │   ├── Toast.jsx
    │   ├── activities/
    │   │   ├── ActivitiesTab.jsx
    │   │   └── ActivityModal.jsx
    │   ├── schedule/
    │   │   ├── CombinedScheduleTable.jsx
    │   │   ├── CombinedScheduleView.jsx
    │   │   ├── GanttChart.jsx
    │   │   ├── ScheduleTab.jsx
    │   │   └── ScheduleTaskTable.jsx
    │   └── tasks/
    │       ├── ColumnSettingsModal.jsx
    │       ├── DiagramModal.jsx
    │       ├── KanbanBoard.jsx
    │       ├── PanelSection.jsx
    │       ├── TasksTab.jsx
    │       └── VersionModal.jsx
    ├── lib/
    │   └── supabaseClient.js
    └── utils/
        ├── exportPdf.js
        ├── files.js
        ├── format.js
        ├── schedule.js
        ├── svgColor.js
        └── versioning.js

## Instalação (ambiente novo, do zero)

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior)
- Uma conta no [Supabase](https://supabase.com/)

### 2. Instalar dependências

Na raiz do projeto:

```bash
npm install
```

Principais pacotes usados: `react`, `react-dom`, `@supabase/supabase-js`, `jspdf`.

### 3. Criar e configurar o projeto no Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com/).
2. Vá em **SQL Editor** → cole o conteúdo completo de `supabase/schema.sql` → **Run**.
3. Confira em **Storage** se o bucket `attachments` foi criado.
4. Vá em **Settings → API** e copie a **Project URL** e a chave **anon public**.

### 4. Configurar variáveis de ambiente

Preencha o `.env` com as credenciais do passo anterior. O `.env` já está no `.gitignore` — não é enviado ao Git.

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

- **+ Nova Atividade**: escolha o tipo (Reunião, Melhoria ou Correção). Melhoria e Correção ganham campos de Título, Complexidade (Mínima/Média/Grande) e Prioridade (sugerida automaticamente pelo tipo, mas editável).
- Melhoria e Correção criam automaticamente um card na coluna "Não atribuídos" do quadro de Tarefas, copiando título, complexidade, prioridade, descrição e anexos.
- Clique em qualquer card da lista para editar ou excluir.
- Use os filtros (Todos / Reuniões / Melhorias / Correções) para focar num tipo específico.
- **📄 Exportar Agenda (PDF)**: gera um PDF com todas as reuniões do projeto, em ordem cronológica, com data, participante e descrição.

### Tarefas → Quadro Kanban

- **+ Nova Coluna**: cria uma coluna no quadro.
- Clique no **nome de uma coluna** para configurá-la: renomear, marcar como "indicador" (aparece na barra lateral), escolher uma cor para a borda dos cards, e marcar como "coluna de versão" (ver seção Versionamento).
- Use as setas **←** / **→** no cabeçalho da coluna para reordená-las.
- Arraste os cards para mover entre colunas ou reordenar dentro da mesma coluna.
- Cada card tem título, solicitante, data, prioridade, complexidade, descrição e anexos.

### Tarefas → Painel

- **+ Criar anotação**: escolha entre **Diagrama**, **Nota** ou **Arquivo**.
- **Diagrama** abre o editor completo do draw.io. No modo visualização, use os botões de zoom, **🔁 Inverter cores** (caso o diagrama apareça com cores trocadas por causa de modo escuro do navegador/extensões) e **⬇ PNG** / **⬇ SVG** para exportar.
- **Nota** tem uma barra de ferramentas com negrito, itálico, sublinhado, taxado, grifar, fonte, lista com marcadores, lista numerada e checklist (clique no quadradinho `[]` para marcar/desmarcar).
- Arraste os itens pela alcinha (⠿) no topo de cada um. Notas e arquivos podem ser redimensionados pelo cantinho inferior direito.
- Use **▲** (trazer para frente) e **▼** (enviar para trás) para controlar sobreposição entre itens.

### Cronograma

- **+ Nova Tarefa**: cria uma linha na tabela, com duração de 1 dia a partir de hoje por padrão.
- **Duração + Início** calculam o **Término** automaticamente (ex: 1 dia a partir de 06/07 vira 07/07). O campo Término não é editável diretamente.
- **← / →** na coluna do nome indentam/recuam a tarefa (hierarquia/WBS). Tarefas com subtarefas ganham uma seta ▾/▸ para recolher/expandir — afeta a tabela e o gráfico juntos.
- **Predecessoras**: digite os números da coluna ID (ex: "1, 3") das tarefas que precisam acontecer antes. Isso desenha uma seta de dependência no gráfico. Não há reagendamento automático — mover a data de uma predecessora não desloca quem depende dela.
- **Cor**: escolha uma cor personalizada para a barra daquela tarefa no gráfico.
- **↑ / ↓** reordenam a tarefa na lista.
- O gráfico à direita mostra dias/semanas/meses (alterne pelos botões **Dia / Semana / Mês**), com fins de semana destacados, uma linha marcando o dia de hoje, e losangos para tarefas de duração zero (marcos).
- Arraste a divisória entre a tabela e o gráfico para redimensionar — a largura escolhida é lembrada no navegador.

### Versionamento

- O botão com a versão atual (ex: **v1.0.0**) aparece abaixo do nome do projeto, alinhado à direita. Clique para abrir o painel de versionamento.
- Marque uma coluna do quadro Kanban como "coluna de versão" (nas configurações da coluna). Só uma por projeto.
- Configure quantos itens de cada complexidade são necessários pra subir aquela posição do número: **Grande** sobe o 1º número, **Média** o 2º, **Mínima** o 3º — cada um sobe de forma independente, sem zerar os outros.
- Sempre que um item cai na coluna de versão (seja criado direto ali, seja arrastado de outra coluna), ele conta para a complexidade dele. Se um item for retirado e colocado de volta, conta novamente.
- Ao atingir o limite configurado, a versão sobe automaticamente e um registro de histórico é criado, guardando o título de todos os itens que contribuíram — esse histórico permanece mesmo que os itens originais sejam excluídos depois.

### Cronograma Geral e por pasta

- **📅 Cronograma Geral** (barra lateral): mostra as tarefas de cronograma de todos os projetos cadastrados, numa única linha do tempo.
- **📅** ao lado do nome de uma pasta: mesma visão, mas só com os projetos daquela pasta.
- Cada tarefa aparece com uma tag colorida indicando o projeto de origem. Use os chips no topo para mostrar/esconder projetos específicos.
- Essa visão é somente leitura. Clique numa linha da tabela para abrir o projeto correspondente, já na aba Cronograma dele, pronta para editar.

### Anexos

- Disponíveis em atividades e em cards de tarefas, aceitando imagem, PDF, Word, Excel, PowerPoint e formatos equivalentes.
- Um item pode ter **vários anexos** — todos aparecem listados dentro do modal, cada um com nome e botão de remover.
- Na lista, um único anexo mostra preview (se imagem) ou link; dois ou mais mostram um resumo "📎 N anexos".

## Limitações conhecidas

- Sem autenticação — veja a seção Segurança acima.
- Criar/renomear/excluir coluna do Kanban e pasta ainda usam `prompt()`/`confirm()` nativos do navegador, que não funcionam dentro de alguns visualizadores embutidos (ex: painel "Simple Browser" do VS Code). Funciona normalmente numa aba de navegador comum (Chrome, Edge, Firefox).
- Arquivos removidos de um item continuam existindo no Storage do Supabase (não há limpeza automática).
- Diagramas do draw.io podem aparecer com cores invertidas dependendo de configurações de modo escuro do navegador/sistema/extensões — use o botão "Inverter cores" no visualizador como correção manual.
- O editor de texto rico das notas do Painel usa `document.execCommand`, um recurso do navegador tecnicamente descontinuado (ainda funcional em todos os navegadores atuais).
- Mudar o limite de complexidade do versionamento não recalcula retroativamente contadores já acumulados.
