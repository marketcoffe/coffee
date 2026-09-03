/**
 * Genera e imprime un REPORTE de ventas/resumen para impresora termica.
 * Util para cierre de caja, reporte diario, o resumen de pedidos.
 */

import { printThermalTicket, PaperSize } from '../../../utils/printBase';

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
  const paperSize: PaperSize = config?.print_config?.paper_size || '58mm';
  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const now = new Date().toLocaleString('es-VE');

  let pedidosHtml = '';
  if (data.pedidos && data.pedidos.length > 0) {
    data.pedidos.forEach(p => {
      pedidosHtml += `
        <tr>
          <td style="width:30px">${p.id}</td>
          <td>${p.cliente}</td>
          <td style="text-align:center;width:20px">${p.items}</td>
          <td style="text-align:right;width:36px">$${p.total.toFixed(2)}</td>
        </tr>`;
    });
  }

  const body = `
  <!-- Header -->
  <div class="center bold large">${businessName}</div>
  <div class="double-line"></div>

  <!-- Badge Grande -->
  <div style="text-align:center;margin:6px 0">
    <div class="badge">${data.titulo}</div>
  </div>
  <div class="double-line"></div>

  <!-- Fechas -->
  <div style="margin:4px 0">
    <div class="small bold">Generado: ${now}</div>
    ${data.fechaDesde ? `<div class="small">Desde: ${data.fechaDesde}</div>` : ''}
    ${data.fechaHasta ? `<div class="small">Hasta: ${data.fechaHasta}</div>` : ''}
  </div>
  <div class="line"></div>

  <!-- Resumen de Pedidos -->
  <table>
    <tr><td colspan="2" class="small bold" style="border-top:1px solid #000;padding-top:3px;padding-bottom:2px">PEDIDOS</td></tr>
    <tr><td class="small">Total pedidos:</td><td class="small" style="text-align:right">${data.totalPedidos}</td></tr>
    <tr><td class="small">Delivery:</td><td class="small" style="text-align:right">${data.porDelivery}</td></tr>
    <tr><td class="small">Pickup:</td><td class="small" style="text-align:right">${data.porPickup}</td></tr>
    <tr><td class="small">Mesa:</td><td class="small" style="text-align:right">${data.porMesa}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Resumen Financiero -->
  <table>
    <tr><td colspan="2" class="small bold" style="border-top:1px solid #000;padding-top:3px;padding-bottom:2px">INGRESOS</td></tr>
    <tr><td class="small">Subtotal:</td><td class="small" style="text-align:right">$${data.totalIngresos.toFixed(2)}</td></tr>
    ${data.totalEnvios > 0 ? `<tr><td class="small">Envios:</td><td class="small" style="text-align:right">$${data.totalEnvios.toFixed(2)}</td></tr>` : ''}
    ${data.totalDescuentos > 0 ? `<tr><td class="small">Descuentos:</td><td class="small" style="text-align:right">-$${data.totalDescuentos.toFixed(2)}</td></tr>` : ''}
    <tr><td class="small">IVA (16%):</td><td class="small" style="text-align:right">$${data.totalIVA.toFixed(2)}</td></tr>
    <tr><td class="medium bold" style="border-top:2px solid #000;padding-top:3px">TOTAL:</td><td class="medium bold" style="border-top:2px solid #000;padding-top:3px;text-align:right">$${(data.totalIngresos + data.totalEnvios - data.totalDescuentos).toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Metodos de Pago -->
  <table>
    <tr><td colspan="2" class="small bold" style="border-top:1px solid #000;padding-top:3px;padding-bottom:2px">FORMAS DE PAGO</td></tr>
    ${data.efectivo > 0 ? `<tr><td class="small">Efectivo:</td><td class="small" style="text-align:right">$${data.efectivo.toFixed(2)}</td></tr>` : ''}
    ${data.tdc > 0 ? `<tr><td class="small">TDC/TDD:</td><td class="small" style="text-align:right">$${data.tdc.toFixed(2)}</td></tr>` : ''}
    ${data.pagoMovil > 0 ? `<tr><td class="small">Pago Movil:</td><td class="small" style="text-align:right">$${data.pagoMovil.toFixed(2)}</td></tr>` : ''}
    ${data.otroPago > 0 ? `<tr><td class="small">Otro:</td><td class="small" style="text-align:right">$${data.otroPago.toFixed(2)}</td></tr>` : ''}
  </table>

  ${data.pedidos && data.pedidos.length > 0 ? `
  <div class="line"></div>
  <!-- Detalle de Pedidos -->
  <div class="small bold" style="margin-bottom:3px">DETALLE (${data.pedidos.length} pedidos):</div>
  <table>
    <tr style="border-bottom:1px solid #000">
      <td style="width:30px" class="small">ID</td>
      <td class="small">Cliente</td>
      <td style="text-align:center;width:20px" class="small">It</td>
      <td style="text-align:right;width:36px" class="small">Total</td>
    </tr>
    ${pedidosHtml}
  </table>
  ` : ''}

  <div class="double-line"></div>
  <div class="center medium bold">${businessName}</div>
  <div class="center small">Reporte generado automaticamente</div>`;

  printThermalTicket(data.titulo, body, paperSize);
}
