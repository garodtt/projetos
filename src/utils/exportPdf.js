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