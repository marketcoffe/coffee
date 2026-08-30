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

  const body = `
  <!-- Header -->
  <div class="center bold large">${businessName}</div>
  ${address ? `<div class="center xsmall">${address}</div>` : ''}
  <div class="double-line"></div>

  <div style="text-align:center;font-size:10px;font-weight:bold;letter-spacing:1px;padding:3px 0;border:1px solid #000;margin:3px 0">${data.titulo}</div>

  <!-- Fechas -->
  <div style="margin:3px 0">
    <div class="xsmall bold">Generado: ${now}</div>
    ${data.fechaDesde ? `<div class="xsmall">Desde: ${data.fechaDesde}</div>` : ''}
    ${data.fechaHasta ? `<div class="xsmall">Hasta: ${data.fechaHasta}</div>` : ''}
  </div>
  <div class="line"></div>

  <!-- Resumen de Pedidos -->
  <table>
    <tr><td colspan="2" style="font-size:9px;font-weight:bold;border-top:1px solid #000;padding-top:3px;padding-bottom:1px">PEDIDOS</td></tr>
    <tr><td style="font-size:8px;padding:1px 0">Total pedidos:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">${data.totalPedidos}</td></tr>
    <tr><td style="font-size:8px;padding:1px 0">Delivery:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">${data.porDelivery}</td></tr>
    <tr><td style="font-size:8px;padding:1px 0">Pickup:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">${data.porPickup}</td></tr>
    <tr><td style="font-size:8px;padding:1px 0">Mesa:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">${data.porMesa}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Resumen Financiero -->
  <table>
    <tr><td colspan="2" style="font-size:9px;font-weight:bold;border-top:1px solid #000;padding-top:3px;padding-bottom:1px">INGRESOS</td></tr>
    <tr><td style="font-size:8px;padding:1px 0">Subtotal:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.totalIngresos.toFixed(2)}</td></tr>
    ${data.totalEnvios > 0 ? `<tr><td style="font-size:8px;padding:1px 0">Envios:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.totalEnvios.toFixed(2)}</td></tr>` : ''}
    ${data.totalDescuentos > 0 ? `<tr><td style="font-size:8px;padding:1px 0">Descuentos:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">-$${data.totalDescuentos.toFixed(2)}</td></tr>` : ''}
    <tr><td style="font-size:8px;padding:1px 0">IVA (16%):</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.totalIVA.toFixed(2)}</td></tr>
    <tr><td style="font-size:10px;font-weight:bold;border-top:2px solid #000;padding-top:3px;padding:1px 0">TOTAL:</td><td style="font-size:10px;font-weight:bold;border-top:2px solid #000;padding-top:3px;text-align:right;padding:1px 0">$${(data.totalIngresos + data.totalEnvios - data.totalDescuentos).toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Metodos de Pago -->
  <table>
    <tr><td colspan="2" style="font-size:9px;font-weight:bold;border-top:1px solid #000;padding-top:3px;padding-bottom:1px">FORMAS DE PAGO</td></tr>
    ${data.efectivo > 0 ? `<tr><td style="font-size:8px;padding:1px 0">Efectivo:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.efectivo.toFixed(2)}</td></tr>` : ''}
    ${data.tdc > 0 ? `<tr><td style="font-size:8px;padding:1px 0">TDC/TDD:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.tdc.toFixed(2)}</td></tr>` : ''}
    ${data.pagoMovil > 0 ? `<tr><td style="font-size:8px;padding:1px 0">Pago Movil:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.pagoMovil.toFixed(2)}</td></tr>` : ''}
    ${data.otroPago > 0 ? `<tr><td style="font-size:8px;padding:1px 0">Otro:</td><td style="font-size:8px;padding:1px 0;text-align:right;font-weight:bold">$${data.otroPago.toFixed(2)}</td></tr>` : ''}
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
  <div class="center xsmall">Reporte generado automaticamente</div>`;

  printThermalTicket(data.titulo, body, paperSize);
}
