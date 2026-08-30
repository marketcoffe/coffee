import { Order } from '../../types/store';
import { printThermalTicket, PaperSize } from './printBase';

/**
 * Genera e imprime una FACTURA simplificada para impresora termica.
 * Incluye datos fiscales: RIF, numero de factura, IVA desglosado, metodo de pago.
 */
export function printFactura(order: Order, config: any) {
  const paperSize: PaperSize = config?.print_config?.paper_size || '58mm';
  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const address = config?.direccion_fisica || '';
  const phone = config?.telefono_soporte || '';
  const rif = config?.rif || config?.cedula || '';
  const date = new Date(order.fecha).toLocaleString('es-VE');
  const orderId = order.id.slice(-8);

  const subtotal = order.subtotal_usd || order.total_usd || 0;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;
  const iva = (subtotal - discount) * 0.16;
  const total = order.total_usd || (subtotal + shipping - discount);

  const deliveryLabel = order.tipo_entrega === 'delivery' ? 'DELIVERY' :
    order.tipo_entrega === 'pickup' ? 'PICKUP' :
    order.tipo_entrega === 'mesa' ? `MESA #${order.numero_mesa || ''}` :
    (order.tipo_entrega as string)?.toUpperCase() || '';

  const facturaNum = `FC-${orderId}`;

  let itemsHtml = '';
  order.items?.forEach(item => {
    const itemSubtotal = item.precio_usd * item.cantidad;
    const itemIva = itemSubtotal * 0.16;
    const itemTotal = itemSubtotal + itemIva;
    itemsHtml += `
      <tr>
        <td style="width:20px;text-align:center;font-size:8px">${item.cantidad}x</td>
        <td style="font-size:8px">${item.nombre}</td>
        <td style="text-align:right;width:46px;font-size:8px">$${itemTotal.toFixed(2)}</td>
      </tr>`;
  });

  const body = `
  <!-- Header Fiscal -->
  <div class="center bold large">${businessName}</div>
  ${rif ? `<div class="center small">RIF: ${rif}</div>` : ''}
  ${address ? `<div class="center xsmall">${address}</div>` : ''}
  ${phone ? `<div class="center xsmall">Tel: ${phone}</div>` : ''}
  <div class="double-line"></div>

  <div style="text-align:center;font-size:10px;font-weight:bold;letter-spacing:1px;padding:3px 0;border:1px solid #000;margin:3px 0">FACTURA</div>

  <!-- Datos de la Factura -->
  <div style="margin:3px 0">
    <div style="display:flex;justify-content:space-between;font-size:7px">
      <span class="bold">Nro:</span>
      <span>${facturaNum}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:7px">
      <span class="bold">Fecha:</span>
      <span>${date}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:7px">
      <span class="bold">Tipo:</span>
      <span>${deliveryLabel}</span>
    </div>
  </div>
  <div class="line"></div>

  <!-- Datos del Cliente -->
  <div class="xsmall bold" style="margin-bottom:1px">CLIENTE:</div>
  <div class="small bold">${order.nombre_cliente || order.cliente_nombre || 'Cliente'}</div>
  ${order.cliente_telefono ? `<div class="xsmall">Tel: ${order.cliente_telefono}</div>` : ''}
  ${order.tipo_entrega === 'delivery' && order.direccion_envio ? `<div class="xsmall">Dir: ${order.direccion_envio}</div>` : ''}
  <div class="line"></div>

  <!-- Detalle de Items -->
  <div class="xsmall bold" style="margin-bottom:2px">DETALLE:</div>
  <table>
    <tr style="border-bottom:1px solid #000">
      <td style="width:20px;font-size:7px;font-weight:bold">Cant</td>
      <td style="font-size:7px;font-weight:bold">Producto</td>
      <td style="text-align:right;width:46px;font-size:7px;font-weight:bold">Total</td>
    </tr>
    ${itemsHtml}
  </table>
  <div class="line"></div>

  <!-- Totales Fiscales -->
  <table class="totals">
    <tr><td>Subtotal:</td><td>$${subtotal.toFixed(2)}</td></tr>
    ${discount > 0 ? `<tr><td>Descuento:</td><td>-$${discount.toFixed(2)}</td></tr>` : ''}
    ${shipping > 0 ? `<tr><td>Envio:</td><td>$${shipping.toFixed(2)}</td></tr>` : ''}
    <tr class="iva-row" style="font-size:8px;font-style:italic"><td>IVA (16%):</td><td>$${iva.toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td>$${total.toFixed(2)}</td></tr>
  </table>
  <div class="double-line"></div>

  <!-- Metodo de Pago -->
  <div style="display:flex;justify-content:space-between;margin-bottom:3px">
    <div>
      <div class="xsmall">FORMA PAGO</div>
      <div class="small bold">${order.metodo_pago || 'N/A'}</div>
    </div>
    <div style="text-align:right">
      <div class="xsmall">MONEDA</div>
      <div class="small bold">USD</div>
    </div>
  </div>
  ${order.referencia_pago ? `<div class="xsmall">REF: ${order.referencia_pago}</div>` : ''}
  ${order.banco_origen ? `<div class="xsmall">BANCO: ${order.banco_origen}</div>` : ''}
  <div class="line"></div>

  <!-- Pie Fiscal -->
  <div class="center xsmall" style="margin-top:2px">Este documento no constituye factura fiscal.</div>
  <div class="center xsmall">computarizada</div>
  <div class="center small bold" style="margin-top:3px">Gracias por su compra!</div>
  <div class="center xsmall">Market Coffee Sweet</div>`;

  printThermalTicket(`Factura ${facturaNum}`, body, paperSize);
}
