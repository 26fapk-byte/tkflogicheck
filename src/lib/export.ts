import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { ChecklistRecord } from '../types';

export function exportToCSV(records: ChecklistRecord[], filename = 'registros.csv') {
  const data = records.map(r => ({
    'Data': r.data,
    'Hora': r.hora,
    'Operador': r.operador,
    'Equipamento': r.equipamento,
    'Item': r.item,
    'Status': r.status,
    'Observação': r.observacao,
    'Patrimônio': r.patrimonio,
    'Horímetro': r.horimetro
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(
  records: ChecklistRecord[],
  title = 'Relatório de Checklists',
  filename = 'relatorio.pdf'
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  pdf.setFontSize(16);
  pdf.text(title, 10, 10);

  pdf.setFontSize(10);
  pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 10, 20);

  pdf.setFontSize(9);
  let y = 30;
  const pageHeight = pdf.internal.pageSize.getHeight();

  records.forEach((record, index) => {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 10;
    }

    pdf.text(`${index + 1}. ${record.data} ${record.hora} - ${record.operador}`, 10, y);
    pdf.text(`   ${record.equipamento}`, 10, y + 5);
    pdf.text(`   ${record.item}: ${record.status}`, 10, y + 10);

    if (record.observacao) {
      pdf.setFontSize(8);
      pdf.text(`   Obs: ${record.observacao}`, 10, y + 15);
      pdf.setFontSize(9);
      y += 20;
    } else {
      y += 15;
    }
  });

  pdf.save(filename);
}

export async function exportTableToPDF(
  elementId: string,
  filename = 'table.pdf'
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const imgWidth = 280;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
  pdf.save(filename);
}
