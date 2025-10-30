import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const reportSection = document.getElementById('report-section');
const dataSection = document.getElementById('data-section');
const reportBtn = document.getElementById('report-view-btn');
const dataBtn = document.getElementById('data-view-btn');

// Alternar vistas
reportBtn.addEventListener('click', () => {
  reportSection.classList.remove('hidden');
  dataSection.classList.add('hidden');
});
dataBtn.addEventListener('click', () => {
  dataSection.classList.remove('hidden');
  reportSection.classList.add('hidden');
});

// Generar reporte (simulado)
document.getElementById('generate-report-btn').addEventListener('click', () => {
  const empresa = document.getElementById('empresa-select').value;
  if (!empresa) return alertUser("Seleccione una empresa.", "warning");

  const data = [
    { codigo: "1001", cuenta: "Caja General", debe: 12000, haber: 0 },
    { codigo: "2001", cuenta: "Cuentas por Pagar", debe: 0, haber: 3000 },
    { codigo: "3001", cuenta: "Capital Social", debe: 0, haber: 9000 },
  ];
  renderTable(data);
  alertUser("Reporte generado correctamente.", "success");
});

// Renderizar tabla
const renderTable = (data) => {
  const body = document.querySelector('#report-table tbody');
  body.innerHTML = "";
  let totalDebe = 0, totalHaber = 0;

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.codigo}</td>
      <td>${row.cuenta}</td>
      <td class="text-right">${formatCurrency(row.debe)}</td>
      <td class="text-right">${formatCurrency(row.haber)}</td>
    `;
    body.appendChild(tr);
    totalDebe += row.debe;
    totalHaber += row.haber;
  });

  const totalRow = document.createElement('tr');
  totalRow.classList.add('font-bold', 'bg-gray-100');
  totalRow.innerHTML = `
    <td colspan="2" class="text-right">Totales:</td>
    <td class="text-right">${formatCurrency(totalDebe)}</td>
    <td class="text-right">${formatCurrency(totalHaber)}</td>
  `;
  body.appendChild(totalRow);
};

const formatCurrency = (v) =>
  v.toLocaleString("es-HN", { style: "currency", currency: "HNL" });

// Exportar Excel
document.getElementById('export-excel-btn').addEventListener('click', () => {
  const table = document.getElementById('report-table');
  const wb = XLSX.utils.table_to_book(table, { sheet: "Reporte" });
  XLSX.writeFile(wb, "reporte_financiero.xlsx");
});

// Exportar PDF
document.getElementById('export-pdf-btn').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Reporte Financiero", 14, 15);
  doc.autoTable({ html: "#report-table", startY: 25 });
  doc.save("reporte_financiero.pdf");
});

// Alerta flotante
const alertUser = (msg, type = "info") => {
  const colors = {
    info: "bg-blue-100 text-blue-800 border-blue-300",
    success: "bg-green-100 text-green-800 border-green-300",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
    error: "bg-red-100 text-red-800 border-red-300",
  };
  const div = document.createElement("div");
  div.className = `${colors[type]} border rounded-lg p-3 fixed top-6 right-6 shadow-lg text-sm font-medium z-50`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
};
