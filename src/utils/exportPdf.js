import { jsPDF } from 'jspdf';
import { formatDate } from './format';

export function exportMeetingsPdf(projectName, activities) {
  const meetings = (activities || []).filter(a => a.type === 'reuniao');
  if (!meetings.length) {
    alert('Nenhuma reunião registrada ainda.');
    return;
  }

  const sorted = [...meetings].sort((a, b) => new Date(a.activity_date) - new Date(b.activity_date));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginLeft = 15;
  const marginRight = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(projectName || 'Projeto', marginLeft, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Agenda de Reuniões', marginLeft, y);
  y += 4;
  doc.setDrawColor(180);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 10;

  sorted.forEach(m => {
    const header = `${formatDate(m.activity_date)}  —  ${m.person_name}`;
    const descLines = doc.splitTextToSize(m.description || '(sem descrição)', usableWidth);
    const blockHeight = 7 + descLines.length * 5 + 8;

    if (y + blockHeight > pageHeight - 15) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(header, marginLeft, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(descLines, marginLeft, y);
    y += descLines.length * 5;

    y += 3;
    doc.setDrawColor(225);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 7;
  });

  const fileSafeName = (projectName || 'projeto').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`agenda-reunioes-${fileSafeName || 'projeto'}.pdf`);
}

// Exporta o cronograma como tabela em PDF (paisagem). Não é uma captura
// visual do gráfico de Gantt — é a mesma informação da tabela, em formato
// de documento, pro mesmo uso que já existe pra Atividades (mandar pra
// alguém de fora sem precisar de print de tela).
export function exportSchedulePdf(projectName, tasks, displayNumberByTaskId, predecessorsTextByTaskId) {
  const visible = (tasks || []).filter(t => !t.deleted_at);
  if (!visible.length) {
    alert('Não há tarefas no cronograma para exportar.');
    return;
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const marginLeft = 10;
  const marginRight = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  const cols = [
    { key: 'id', label: 'ID', width: 8 },
    { key: 'name', label: 'Nome da Tarefa', width: 78 },
    { key: 'duration', label: 'Duração', width: 22 },
    { key: 'start', label: 'Início', width: 20 },
    { key: 'end', label: 'Término', width: 20 },
    { key: 'progress', label: 'Progr.', width: 14 },
    { key: 'preds', label: 'Predec.', width: 24 },
    { key: 'resources', label: 'Recursos', width: 90 },
  ];
  const colX = [];
  let acc = marginLeft;
  cols.forEach(c => { colX.push(acc); acc += c.width; });

  function drawHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(projectName || 'Projeto', marginLeft, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Cronograma', marginLeft, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    cols.forEach((c, i) => doc.text(c.label, colX[i], y));
    y += 2;
    doc.setDrawColor(160);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
  }

  const durationLabels = { horas: 'h', dias: 'd', semanas: 'sem' };
  drawHeader();

  visible.forEach(task => {
    const rowValues = {
      id: String(displayNumberByTaskId?.[task.id] ?? ''),
      name: '  '.repeat(task.level || 0) + (task.name || ''),
      duration: `${task.duration_value} ${durationLabels[task.duration_unit] || task.duration_unit}`,
      start: formatDate(task.start_date),
      end: formatDate(task.end_date),
      progress: `${task.progress_percent ?? 0}%`,
      preds: predecessorsTextByTaskId?.[task.id] || '—',
      resources: task.resource_names || '—',
    };

    const wrapped = {};
    let maxLines = 1;
    cols.forEach(c => {
      const lines = doc.splitTextToSize(String(rowValues[c.key] ?? ''), c.width - 2);
      wrapped[c.key] = lines;
      maxLines = Math.max(maxLines, lines.length);
    });
    const rowHeight = maxLines * 4 + 2;

    if (y + rowHeight > pageHeight - 12) {
      doc.addPage();
      y = 15;
      drawHeader();
    }

    cols.forEach((c, i) => doc.text(wrapped[c.key], colX[i], y));
    y += rowHeight;
    doc.setDrawColor(225);
    doc.line(marginLeft, y - rowHeight + 1, pageWidth - marginRight, y - rowHeight + 1);
  });

  const fileSafeName2 = (projectName || 'projeto').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`cronograma-${fileSafeName2 || 'projeto'}.pdf`);
}