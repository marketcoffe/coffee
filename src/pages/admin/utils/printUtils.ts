import { Order } from '../../../types/store';
import { printThermalTicket, PaperSize } from '../../../utils/printBase';

export function printOrderTicket(order: Order, config: any) {
  const paperSize: PaperSize = config?.print_config?.paper_size || '58mm';
  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const address = config?.direccion_fisica || '';
  const phone = config?.telefono_soporte || '';
  const date = new Date(order.fecha).toLocaleString('es-VE');
  const orderId = order.id;

  const subtotal = order.subtotal_usd || order.total_usd;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;
  const iva = subtotal * 0.16;

  const deliveryLabel = order.tipo_entrega === 'delivery' ? 'DELIVERY' :
    order.tipo_entrega === 'pickup' ? 'PICKUP' :
    order.tipo_entrega === 'mesa' ? `MESA #${order.numero_mesa || ''}` :
    (order.tipo_entrega as string)?.toUpperCase() || '';

  const paymentLabel = order.metodo_pago || 'N/A';

  let itemsHtml = '';
  order.items?.forEach(item => {
    const optStr = item.selected_options?.length
      ? `<div style="font-size:8px;color:#666;margin-left:6px">${item.selected_options.map(o => o.option_name).join(', ')}</div>`
      : '';
    const removedStr = item.ingredientes_removidos?.length
      ? `<div style="font-size:8px;color:#c00;margin-left:6px;text-decoration:line-through">Sin: ${item.ingredientes_removidos.join(', ')}</div>`
      : '';
    const itemTotal = (item.precio_usd * item.cantidad).toFixed(2);
    itemsHtml += `
      <tr class="item-row">
        <td style="width:24px;text-align:center">${item.cantidad}x</td>
        <td>
          ${item.nombre}
          ${optStr}
          ${removedStr}
        </td>
        <td style="text-align:right;width:50px">$${itemTotal}</td>
      </tr>`;
  });

  const body = `
  <!-- Business Header -->
  <div class="center bold large">${businessName}</div>
  ${address ? `<div class="center xsmall">${address}</div>` : ''}
  ${phone ? `<div class="center xsmall">Tel: ${phone}</div>` : ''}
  <div class="double-line"></div>

  <!-- Order Info -->
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div class="medium bold">PEDIDO #${orderId}</div>
    <div class="badge">${deliveryLabel}</div>
  </div>
  <div class="xsmall" style="margin-top:2px">${date}</div>
  <div class="small bold">${order.cliente_nombre}</div>
  <div class="xsmall">${order.cliente_telefono}</div>
  <div class="line"></div>

  ${order.notas_admin ? `
  <div style="margin:3px 0;padding:3px;border:1px dashed #000">
    <div class="small" style="margin-bottom:1px">NOTAS:</div>
    <div class="medium">${order.notas_admin}</div>
  </div>` : ''}

  <!-- Items -->
  <div class="xsmall bold" style="margin-bottom:2px">ITEMS:</div>
  <table>
    ${itemsHtml}
  </table>
  <div class="line"></div>

  <!-- Financial Summary -->
  <table class="totals">
    <tr><td>Subtotal:</td><td>$${subtotal.toFixed(2)}</td></tr>
    ${shipping > 0 ? `<tr><td>Envio:</td><td>$${shipping.toFixed(2)}</td></tr>` : ''}
    ${discount > 0 ? `<tr><td>Descuento${order.cupon_codigo ? ` (${order.cupon_codigo})` : ''}:</td><td>-$${discount.toFixed(2)}</td></tr>` : ''}
    <tr><td>IVA (16%):</td><td>$${iva.toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td>$${order.total_usd?.toFixed(2)}${order.total_bs ? ` / ${order.total_bs.toFixed(2)} Bs.` : ''}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Payment & Delivery -->
  <div style="display:flex;justify-content:space-between">
    <div>
      <div class="xsmall">PAGO</div>
      <div class="small bold">${paymentLabel}</div>
    </div>
    <div style="text-align:right">
      <div class="xsmall">ENTREGA</div>
      <div class="small bold">${deliveryLabel}</div>
    </div>
  </div>
  ${order.tipo_entrega === 'delivery' && order.direccion_envio ? `
  <div style="margin-top:2px">
    <div class="xsmall">DIRECCION:</div>
    <div class="xsmall">${order.direccion_envio}</div>
    ${order.distancia_km ? `<div class="xsmall">Distancia: ${order.distancia_km.toFixed(1)} km</div>` : ''}
  </div>` : ''}
  <div class="double-line"></div>

  <!-- Footer -->
  <div class="center small bold">Gracias por su compra!</div>
  <div class="center xsmall" style="margin-top:1px">Market Coffee Sweet</div>`;

  printThermalTicket(`Pedido #${orderId}`, body, paperSize);
}
