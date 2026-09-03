import { Order } from '../types/store';
import { printThermalTicket, PaperSize } from './printBase';

/**
 * Genera e imprime una FACTURA simplificada para impresora termica.
 * Incluye datos fiscales: RIF, numero de factura, IVA desglosado, metodo de pago.
 */
export function printFactura(order: Order, config: any) {
  const paperSize: PaperSize = config?.print_config?.paper_size || '58mm';
  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const phone = config?.telefono_soporte || '';
  const rif = config?.rif || config?.cedula || '';
  const date = new Date(order.fecha).toLocaleString('es-VE');
  const orderId = order.id;

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
      <tr class="item-row">
        <td style="width:24px;text-align:center">${item.cantidad}x</td>
        <td>${item.nombre}</td>
        <td style="text-align:right;width:50px">$${itemTotal.toFixed(2)}</td>
      </tr>`;
  });

  const body = `
  <!-- Header Fiscal -->
  <div class="center bold large">${businessName}</div>
  ${rif ? `<div class="center small">RIF: ${rif}</div>` : ''}
  ${phone ? `<div class="center small">Tel: ${phone}</div>` : ''}
  <div class="double-line"></div>

  <!-- Badge FACTURA Grande -->
  <div style="text-align:center;margin:6px 0">
    <div class="badge">FACTURA</div>
  </div>
  <div class="double-line"></div>

  <!-- Datos de la Factura -->
  <div style="margin:4px 0">
    <div style="display:flex;justify-content:space-between">
      <span class="small bold">Nro:</span>
      <span class="small bold">${facturaNum}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span class="small bold">Fecha:</span>
      <span class="small bold">${date}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span class="small bold">Tipo:</span>
      <span class="small bold">${deliveryLabel}</span>
    </div>
  </div>
  <div class="line"></div>

  <!-- Datos del Cliente -->
  <div class="small bold" style="margin-bottom:2px">CLIENTE:</div>
  <div class="medium bold">${order.nombre_cliente || order.cliente_nombre || 'Cliente'}</div>
  ${order.cliente_telefono ? `<div class="small">Tel: ${order.cliente_telefono}</div>` : ''}
  ${order.tipo_entrega === 'delivery' && order.direccion_envio ? `<div class="small">Dir: ${order.direccion_envio}</div>` : ''}
  <div class="line"></div>

  <!-- Detalle de Items -->
  <div class="small bold" style="margin-bottom:3px">DETALLE:</div>
  <table>
    <tr style="border-bottom:1px solid #000">
      <td style="width:24px" class="small">Cant</td>
      <td class="small">Producto</td>
      <td style="text-align:right;width:50px" class="small">Total</td>
    </tr>
    ${itemsHtml}
  </table>
  <div class="line"></div>

  <!-- Notas debajo de items -->
  ${order.notas_admin ? `
  <div style="margin:4px 0;padding:4px;border:1px dashed #000">
    <div class="small bold" style="margin-bottom:2px">NOTAS:</div>
    <div class="medium">${order.notas_admin}</div>
  </div>` : ''}

  <!-- Totales Fiscales -->
  <table class="totals">
    <tr><td>Subtotal:</td><td>$${subtotal.toFixed(2)}</td></tr>
    ${discount > 0 ? `<tr><td>Descuento:</td><td>-$${discount.toFixed(2)}</td></tr>` : ''}
    ${shipping > 0 ? `<tr><td>Envio:</td><td>$${shipping.toFixed(2)}</td></tr>` : ''}
    <tr style="font-style:italic"><td>IVA (16%):</td><td>$${iva.toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td>$${total.toFixed(2)}${order.total_bs ? ` / ${order.total_bs.toFixed(2)} Bs.` : ''}</td></tr>
  </table>
  <div class="double-line"></div>

  <!-- Metodo de Pago -->
  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
    <div>
      <div class="small">FORMA PAGO</div>
      <div class="medium bold">${order.metodo_pago || 'N/A'}</div>
    </div>
    <div style="text-align:right">
      <div class="small">MONEDA</div>
      <div class="medium bold">USD</div>
    </div>
  </div>
  ${order.referencia_pago ? `<div class="small">REF: ${order.referencia_pago}</div>` : ''}
  ${order.banco_origen ? `<div class="small">BANCO: ${order.banco_origen}</div>` : ''}
  <div class="line"></div>

  <!-- Pie Fiscal -->
  <div class="center small" style="margin-top:3px">Este documento no constituye factura fiscal.</div>
  <div class="center small">computarizada</div>
  <div class="center medium bold" style="margin-top:4px">Gracias por su compra!</div>
  <div class="center small">${businessName}</div>`;

  printThermalTicket(`Factura ${facturaNum}`, body, paperSize);
}
