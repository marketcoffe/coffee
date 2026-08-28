/**
 * Genera e imprime un REPORTE de ventas/resumen para impresora termica 58mm.
 * Util para cierre de caja, reporte diario, o resumen de pedidos.
 */

export interface ReporteData {
  titulo: string;
  fechaDesde?: string;
  fechaHasta?: string;
  totalPedidos: number;
  totalIngresos: number;
  totalEnvios: number;
  totalDescuentos: number;
  totalIVA: number;
  porDelivery: number;
  porPickup: number;
  porMesa: number;
  efectivo: number;
  tdc: number;
  pagoMovil: number;
  otroPago: number;
  pedidos?: Array<{
    id: string;
    fecha: string;
    cliente: string;
    tipo: string;
    items: number;
    total: number;
    metodoPago: string;
  }>;
}

export function printReporte(data: ReporteData, config: any) {
  const w = window.open('', '_blank');
  if (!w) return;

  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const address = config?.direccion_fisica || '';
  const now = new Date().toLocaleString('es-VE');

  let pedidosHtml = '';
  if (data.pedidos && data.pedidos.length > 0) {
    data.pedidos.forEach(p => {
      pedidosHtml += `
        <tr>
          <td style="font-size:7px;width:30px">${p.id.slice(-6)}</td>
          <td style="font-size:7px">${p.cliente}</td>
          <td style="font-size:7px;text-align:center;width:20px">${p.items}</td>
          <td style="font-size:7px;text-align:right;width:36px">$${p.total.toFixed(2)}</td>
        </tr>`;
    });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${data.titulo}</title>
  <style>
    @page { margin: 0; size: 58mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9px;
      width: 48mm;
      padding: 2mm;
      color: #000;
      line-height: 1.3;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 12px; letter-spacing: 1px; }
    .medium { font-size: 9px; }
    .small { font-size: 8px; }
    .xsmall { font-size: 7px; }
    .line { border-top: 1px dashed #000; margin: 3px 0; }
    .double-line { border-top: 2px solid #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .summary td { font-size: 8px; padding: 1px 0; }
    .summary td:last-child { text-align: right; font-weight: bold; }
    .summary .section-row td {
      font-size: 9px;
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 3px;
      padding-bottom: 1px;
    }
    .summary .total-row td {
      font-size: 10px;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 3px;
    }
    .reporte-header {
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 1px;
      padding: 3px 0;
      border: 1px solid #000;
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="center bold large">${businessName}</div>
  ${address ? `<div class="center xsmall">${address}</div>` : ''}
  <div class="double-line"></div>

  <div class="reporte-header">${data.titulo}</div>

  <!-- Fechas -->
  <div style="margin:3px 0">
    <div class="xsmall bold">Generado: ${now}</div>
    ${data.fechaDesde ? `<div class="xsmall">Desde: ${data.fechaDesde}</div>` : ''}
    ${data.fechaHasta ? `<div class="xsmall">Hasta: ${data.fechaHasta}</div>` : ''}
  </div>
  <div class="line"></div>

  <!-- Resumen de Pedidos -->
  <table class="summary">
    <tr class="section-row"><td colspan="2">PEDIDOS</td></tr>
    <tr><td>Total pedidos:</td><td>${data.totalPedidos}</td></tr>
    <tr><td>Delivery:</td><td>${data.porDelivery}</td></tr>
    <tr><td>Pickup:</td><td>${data.porPickup}</td></tr>
    <tr><td>Mesa:</td><td>${data.porMesa}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Resumen Financiero -->
  <table class="summary">
    <tr class="section-row"><td colspan="2">INGRESOS</td></tr>
    <tr><td>Subtotal:</td><td>$${data.totalIngresos.toFixed(2)}</td></tr>
    ${data.totalEnvios > 0 ? `<tr><td>Envios:</td><td>$${data.totalEnvios.toFixed(2)}</td></tr>` : ''}
    ${data.totalDescuentos > 0 ? `<tr><td>Descuentos:</td><td>-$${data.totalDescuentos.toFixed(2)}</td></tr>` : ''}
    <tr><td>IVA (16%):</td><td>$${data.totalIVA.toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td>$${(data.totalIngresos + data.totalEnvios - data.totalDescuentos).toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Metodos de Pago -->
  <table class="summary">
    <tr class="section-row"><td colspan="2">FORMAS DE PAGO</td></tr>
    ${data.efectivo > 0 ? `<tr><td>Efectivo:</td><td>$${data.efectivo.toFixed(2)}</td></tr>` : ''}
    ${data.tdc > 0 ? `<tr><td>TDC/TDD:</td><td>$${data.tdc.toFixed(2)}</td></tr>` : ''}
    ${data.pagoMovil > 0 ? `<tr><td>Pago Movil:</td><td>$${data.pagoMovil.toFixed(2)}</td></tr>` : ''}
    ${data.otroPago > 0 ? `<tr><td>Otro:</td><td>$${data.otroPago.toFixed(2)}</td></tr>` : ''}
  </table>

  ${data.pedidos && data.pedidos.length > 0 ? `
  <div class="line"></div>
  <!-- Detalle de Pedidos -->
  <div class="xsmall bold" style="margin-bottom:2px">DETALLE (${data.pedidos.length} pedidos):</div>
  <table>
    <tr style="border-bottom:1px solid #000">
      <td style="font-size:7px;width:30px;font-weight:bold">ID</td>
      <td style="font-size:7px;font-weight:bold">Cliente</td>
      <td style="font-size:7px;text-align:center;width:20px;font-weight:bold">It</td>
      <td style="font-size:7px;text-align:right;width:36px;font-weight:bold">Total</td>
    </tr>
    ${pedidosHtml}
  </table>
  ` : ''}

  <div class="double-line"></div>
  <div class="center small bold">Market Coffee Sweet</div>
  <div class="center xsmall">Reporte generado automaticamente</div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.print();
}
