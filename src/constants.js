export const UNASSIGNED_COLUMN_NAME = 'Não atribuídos';

export const DRAWIO_EMBED_URL = 'https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json';

export const BLANK_DIAGRAM_XML = '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel>';

export const ACTIVITY_LABELS = {
  reuniao:  { person: 'Participantes', desc: 'O que foi falado / como foi' },
  melhoria: { person: 'Quem solicitou', desc: 'Descreva a melhoria solicitada' },
  correcao: { person: 'Quem solicitou', desc: 'Descreva a correção solicitada' },
};

export const ACTIVITY_TAG_LABEL = { reuniao: 'Reunião', melhoria: 'Melhoria', correcao: 'Correção' };

export const COMPLEXITY_OPTIONS = [
  { value: 'minima', label: 'Mínima' },
  { value: 'media', label: 'Média' },
  { value: 'grande', label: 'Grande' },
];

export const COMPLEXITY_LABEL = { minima: 'Mínima', media: 'Média', grande: 'Grande' };