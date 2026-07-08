# Gestão de Projetos

Sistema web para organizar projetos de desenvolvimento (freelancer ou equipe pequena atendendo clientes): reuniões, solicitações de melhoria/correção, quadro Kanban de tarefas, painel visual livre, cronograma estilo Gantt e controle de versionamento por projeto.

## Funcionalidades

- **Projetos organizados em pastas** — agrupe projetos relacionados (ex: um cliente com várias frentes) na barra lateral, com indicador de pendências por pasta e por projeto.
- **Atividades** — registre reuniões (quem participou, o que foi falado), melhorias e correções solicitadas por clientes, com título, complexidade, prioridade e anexos de qualquer tipo de arquivo. Melhorias e correções viram automaticamente um card no quadro de tarefas. Exporte a agenda de reuniões em PDF.
- **Quadro Kanban (Tarefas)** — colunas totalmente editáveis (nome, indicador na lateral, cor dos cards, coluna de versão), cards com título, solicitante, responsável, prioridade, complexidade, anexos múltiplos, arrastar-e-soltar entre colunas e dentro da mesma coluna.
- **Painel livre** — quadro estilo Miro dentro de cada projeto: diagramas (editor completo do draw.io, com exportação em PNG/SVG), notas com editor de texto rico (negrito, itálico, listas, checklist, grifar) e arquivos de qualquer tipo — todos arrastáveis, redimensionáveis e com controle de camada.
- **Cronograma** — tabela estilo MS Project (nome com hierarquia/WBS, duração, início, término calculado automaticamente respeitando dias úteis, predecessoras, recursos, cor da barra, datas reais) sincronizada com um gráfico de Gantt construído sob medida, com zoom por dia/semana/mês. Mudar a data ou a duração de uma tarefa reagenda automaticamente todas as que dependem dela.
- **Recursos e conflitos** — cadastre pessoas/equipes com capacidade de horas por dia, aloque-as nas tarefas do cronograma e receba aviso automático quando a soma das alocações de um recurso ultrapassa a capacidade dele num mesmo dia. Uma tela dedicada mostra todos os conflitos do sistema de uma vez, em qualquer projeto.
- **Calendário e dias úteis** — configure quais dias da semana contam como úteis, ligue/desligue o cálculo automático de feriados nacionais (com Carnaval e Corpus Christi) e cadastre feriados personalizados. Uma data de início escolhida num dia não-útil é sinalizada, com a opção de mover para o próximo dia útil.
- **Cronograma Geral e por pasta** — visão combinada, somente leitura, de todas as tarefas de cronograma de vários projetos numa linha do tempo só, com tag colorida por projeto.
- **Versionamento por projeto** — cada projeto tem uma versão (major.minor.patch). Configure quantos itens de cada complexidade (grande/média/mínima) são necessários para subir cada posição do número, marque uma coluna do quadro como "coluna de versão", e a versão sobe automaticamente quando itens caem lá — com histórico permanente de quais itens compuseram cada subida.
- **Exclusão segura de projeto** — remove projeto e tudo dentro dele (atividades, tarefas, painel, cronograma, versionamento, anexos), com confirmação por digitação do nome.
- **Busca, lixeira e arquivamento** — encontre qualquer coisa no sistema com a busca global (projetos, atividades, cards, tarefas de cronograma — inclusive por recurso alocado — e diagramas), recupere itens excluídos por engano na lixeira antes que sumam de vez, e arquive projetos concluídos sem apagar nada.

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
    │   ├── ArchivedProjectsModal.jsx
    │   ├── AttachmentsField.jsx
    │   ├── ConflictsModal.jsx
    │   ├── GlobalSearchModal.jsx
    │   ├── ParticipantsField.jsx
    │   ├── ProjectModal.jsx
    │   ├── ProjectVersionModal.jsx
    │   ├── ResourcePicker.jsx
    │   ├── ResourcesModal.jsx
    │   ├── RichTextEditor.jsx
    │   ├── Sidebar.jsx
    │   ├── Spinner.jsx
    │   ├── TextPromptModal.jsx
    │   ├── Toast.jsx
    │   ├── TrashModal.jsx
    │   ├── activities/
    │   │   ├── ActivitiesTab.jsx
    │   │   └── ActivityModal.jsx
    │   ├── schedule/
    │   │   ├── CombinedScheduleTable.jsx
    │   │   ├── CombinedScheduleView.jsx
    │   │   ├── GanttChart.jsx
    │   │   ├── HolidaySettingsModal.jsx
    │   │   ├── NewScheduleTaskModal.jsx
    │   │   ├── ScheduleTab.jsx
    │   │   ├── ScheduleTaskTable.jsx
    │   │   └── TaskResourcesModal.jsx
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
        ├── businessDays.js
        ├── exportPdf.js
        ├── files.js
        ├── format.js
        ├── resources.js
        ├── schedule.js
        ├── svgColor.js
        └── versioning.js
```

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

Copie `.env.example` para `.env` e preencha com as credenciais do passo anterior. O `.env` já está no `.gitignore` — não é enviado ao Git.

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
- Para arquivar um projeto (tirar da lista principal sem apagar nada): **📄 Resumo** → marque **Arquivar projeto**. Veja "Busca, lixeira e projetos arquivados" mais abaixo.

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
- Cada card tem título, solicitante, responsável (opcional, quem vai executar), data, prioridade, complexidade, descrição e anexos.

### Tarefas → Painel

- **+ Criar anotação**: escolha entre **Diagrama**, **Nota** ou **Arquivo**.
- **Diagrama** abre o editor completo do draw.io. No modo visualização, use os botões de zoom, **🔁 Inverter cores** (caso o diagrama apareça com cores trocadas por causa de modo escuro do navegador/extensões) e **⬇ PNG** / **⬇ SVG** para exportar.
- **Nota** tem uma barra de ferramentas com negrito, itálico, sublinhado, taxado, grifar, fonte, lista com marcadores, lista numerada e checklist (clique no quadradinho `[]` para marcar/desmarcar).
- Arraste os itens pela alcinha (⠿) no topo de cada um. Notas e arquivos podem ser redimensionados pelo cantinho inferior direito.
- Use **▲** (trazer para frente) e **▼** (enviar para trás) para controlar sobreposição entre itens.

### Cronograma

- **+ Nova Tarefa**: cria uma linha na tabela, com duração de 1 dia a partir de hoje por padrão (ou do próximo dia útil, se hoje cair num fim de semana/feriado).
- **Duração + Início** calculam o **Término** automaticamente pulando dias não-úteis (ex: 1 dia a partir de uma sexta-feira vira término na segunda-feira seguinte). O campo Término não é editável diretamente.
- Se a data de início escolhida — na criação ou editando depois — cair num sábado, domingo ou feriado, o sistema pergunta antes de qualquer coisa ser salva se quer mover para o próximo dia útil. Se você preferir manter a data mesmo assim, é só cancelar a pergunta.
- **Recursos (obrigatório)**: aloque uma ou mais pessoas/equipes em cada tarefa, com horas/dia dedicadas. Dá pra cadastrar um recurso novo direto no seletor, sem sair do modal. Se a soma das alocações de um recurso num dia ultrapassar a capacidade dele, aparece um aviso com a opção de prosseguir mesmo assim.
- **Predecessoras**: digite os números da coluna ID (ex: "1, 3") das tarefas que precisam acontecer antes. Isso desenha uma seta de dependência no gráfico.
  - Mudar a data ou a duração de uma tarefa **reagenda automaticamente** todas as que dependem dela, direta ou indiretamente — pulando dias não-úteis e recalculando o término de cada uma pela própria duração dela.
  - Se a tarefa que está recebendo a predecessora já começa antes do término dela, o sistema avisa e oferece mover o início para logo em seguida; cancelar mantém a data como está e salva o vínculo do mesmo jeito.
  - Não é possível criar uma dependência circular (uma tarefa depender, direta ou indiretamente, dela mesma) — o sistema bloqueia e explica o motivo.
- **Cor**: escolha uma cor personalizada para a barra daquela tarefa no gráfico.
- **← / →** na coluna do nome indentam/recuam a tarefa (hierarquia/WBS). Tarefas com subtarefas ganham uma seta ▾/▸ para recolher/expandir — afeta a tabela e o gráfico juntos.
- **↑ / ↓** reordenam a tarefa na lista.
- **📊 Datas reais**: alterna a tabela e o gráfico para também mostrar/editar quando a tarefa *realmente* começou e terminou, ao lado do planejado. Não deixa salvar um término real anterior ao início real (ou vice-versa).
- **📅 Calendário**: abre as configurações de dias úteis usadas em todo o cronograma — veja "Calendário e dias úteis" abaixo.
- O gráfico à direita mostra dias/semanas/meses (alterne pelos botões **Dia / Semana / Mês**), com fins de semana destacados, uma linha marcando o dia de hoje, e losangos para tarefas de duração zero (marcos).
- Arraste a divisória entre a tabela e o gráfico para redimensionar — a largura escolhida é lembrada no navegador.

### Calendário e dias úteis

- **📅 Calendário** (dentro do Cronograma de qualquer projeto): as regras valem globalmente, para as tarefas de **todos** os projetos, não só do projeto atual.
- Marque se sábado e/ou domingo contam como dia útil, e se feriados nacionais (com Carnaval e Corpus Christi) entram automaticamente no cálculo.
- Cadastre feriados personalizados (data + nome) — eles se somam aos nacionais.
- Essas regras afetam o cálculo do Término a partir da Duração, o reagendamento automático em cascata das dependências, e o aviso ao escolher uma data de início não-útil.
- O campo "Horas/dia sugeridas" nessa tela é só o valor padrão oferecido ao cadastrar um recurso novo — não é um limite.

### Recursos e conflitos

- **🧑‍💼 Recursos** (barra lateral): cadastro central de pessoas/equipes, com nome, função (opcional) e capacidade de horas por dia. Clique num recurso cadastrado para ver onde ele está alocado no momento (tarefa, projeto e período).
- Excluir um recurso é uma exclusão suave — ele some da lista de seleção, mas o histórico de alocações passadas não é apagado.
- **⚠ Conflitos** (barra lateral): lista, de uma vez só, todos os recursos com alocações que ultrapassam a capacidade diária deles em algum dia, em qualquer projeto — útil pra revisar depois de mudanças em lote, sem precisar abrir tarefa por tarefa.
- Um projeto (ou pasta) com algum conflito de recurso em aberto ganha um ⚠ ao lado do nome, na barra lateral.

### Versionamento

- O botão com a versão atual (ex: **v1.0.0**) aparece abaixo do nome do projeto, alinhado à direita. Clique para abrir o painel de versionamento.
- Marque uma coluna do quadro Kanban como "coluna de versão" (nas configurações da coluna). Só uma por projeto.
- Configure quantos itens de cada complexidade são necessários pra subir aquela posição do número: **Grande** sobe o 1º número, **Média** o 2º, **Mínima** o 3º — cada um sobe de forma independente, sem zerar os outros.
- Sempre que um item cai na coluna de versão pela primeira vez (seja criado direto ali, seja arrastado de outra coluna), ele conta para a complexidade dele. Um selo interno garante que o mesmo item nunca é contado duas vezes — mesmo que ele seja retirado da coluna e colocado de volta depois.
- Ao atingir o limite configurado, a versão sobe automaticamente e um registro de histórico é criado, guardando o título de todos os itens que contribuíram — esse histórico permanece mesmo que os itens originais sejam excluídos depois.

### Cronograma Geral e por pasta

- **📅 Cronograma Geral** (barra lateral): mostra as tarefas de cronograma de todos os projetos cadastrados, numa única linha do tempo.
- **📅** ao lado do nome de uma pasta: mesma visão, mas só com os projetos daquela pasta.
- Cada tarefa aparece com uma tag colorida indicando o projeto de origem. Use os chips no topo para mostrar/esconder projetos específicos.
- Essa visão é somente leitura. Clique numa linha da tabela para abrir o projeto correspondente, já na aba Cronograma dele, pronta para editar.

### Busca, lixeira e projetos arquivados

- **🔍 Buscar** (barra lateral): busca em tempo real (com um pequeno atraso ao digitar) por projetos, pastas, atividades, cards do Kanban, tarefas do cronograma — inclusive pelos recursos alocados nelas — e diagramas do Painel. Clicar num resultado abre o projeto na aba certa.
- **🗑️ Lixeira** (barra lateral): tudo que é excluído no dia a dia — atividades, cards do Kanban, itens do Painel, tarefas do cronograma, colunas do quadro e pastas — passa por aqui antes de sumir de vez. Restaure ou exclua definitivamente item por item. A maioria das exclusões também mostra um botão "Desfazer" na hora, um atalho mais rápido do que abrir a lixeira depois.
- Projetos não passam pela lixeira: excluir um projeto (em **📄 Resumo** → Excluir projeto) é definitivo na hora — veja "Projetos e pastas" acima.
- **📦 Arquivados**: link que aparece embaixo da lista de projetos assim que há pelo menos um projeto arquivado. Arquivar um projeto (checkbox em **📄 Resumo**) só tira ele da lista principal — nada é apagado, e dá pra desarquivar a qualquer momento.

### Anexos

- Disponíveis em atividades e em cards de tarefas, aceitando imagens (jpg, png, gif, webp, bmp, svg), PDF, Word (doc, docx, odt, rtf), Excel (xls, xlsx, ods, csv), PowerPoint (ppt, pptx, odp) e texto simples (txt).
- Um item pode ter **vários anexos** — todos aparecem listados dentro do modal, cada um com nome e botão de remover.
- Na lista, um único anexo mostra preview (se imagem) ou link; dois ou mais mostram um resumo "📎 N anexos".

## Limitações conhecidas

- Sem autenticação — veja a seção Segurança acima.
- Criar/renomear/excluir coluna do Kanban e pasta ainda usam `prompt()`/`confirm()` nativos do navegador, que não funcionam dentro de alguns visualizadores embutidos (ex: painel "Simple Browser" do VS Code). Funciona normalmente numa aba de navegador comum (Chrome, Edge, Firefox).
- Arquivos removidos de um item continuam existindo no Storage do Supabase (não há limpeza automática).
- Diagramas do draw.io podem aparecer com cores invertidas dependendo de configurações de modo escuro do navegador/sistema/extensões — use o botão "Inverter cores" no visualizador como correção manual.
- O editor de texto rico das notas do Painel usa `document.execCommand`, um recurso do navegador tecnicamente descontinuado (ainda funcional em todos os navegadores atuais).
- Mudar o limite de complexidade do versionamento não recalcula retroativamente contadores já acumulados.
- Se uma tarefa do cronograma depende de duas ou mais tarefas ao mesmo tempo, o reagendamento automático em cascata considera apenas a primeira predecessora que muda de data para recalculá-la — ainda não existe uma lógica de "usar a predecessora que empurra mais para frente" quando várias mudam juntas.