import { Order } from '../../../types/store';

export function printOrderTicket(order: Order, config: any) {
  const w = window.open('', '_blank');
  if (!w) return;

  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const address = config?.direccion_fisica || '';
  const phone = config?.telefono_soporte || '';
  const date = new Date(order.fecha).toLocaleString('es-VE');
  const orderId = order.id.slice(-8);

  const subtotal = order.subtotal_usd || order.total_usd;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;
  const iva = subtotal * 0.16;

  const deliveryLabel = order.tipo_entrega === 'delivery' ? 'DELIVERY' :
    order.tipo_entrega === 'pickup' ? 'PICKUP' :
    order.tipo_entrega === 'mesa' ? `MESA #${order.numero_mesa || ''}` :
    order.tipo_entrega?.toUpperCase() || '';

  const paymentLabel = order.metodo_pago || 'N/A';

  let itemsHtml = '';
  order.items?.forEach(item => {
    const optStr = item.selected_options?.length
      ? `<div style="font-size:9px;color:#666;margin-left:8px">${item.selected_options.map(o => o.option_name).join(', ')}</div>`
      : '';
    const removedStr = item.ingredientes_removidos?.length
      ? `<div style="font-size:9px;color:#c00;margin-left:8px;text-decoration:line-through">Sin: ${item.ingredientes_removidos.join(', ')}</div>`
      : '';
    const itemTotal = (item.precio_usd * item.cantidad).toFixed(2);
    itemsHtml += `
      <tr>
        <td style="width:30px;text-align:center;font-weight:bold">${item.cantidad}x</td>
        <td>
          ${item.nombre}
          ${optStr}
          ${removedStr}
        </td>
        <td style="text-align:right;width:60px;font-weight:bold">$${itemTotal}</td>
      </tr>`;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Pedido #${orderId}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 72mm;
      padding: 2mm;
      color: #000;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; letter-spacing: 1px; }
    .medium { font-size: 12px; }
    .small { font-size: 9px; }
    .xsmall { font-size: 8px; }
    .line { border-top: 1px dashed #000; margin: 4px 0; }
    .double-line { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; font-size: 10px; }
    .items-table td:first-child { width: 30px; text-align: center; }
    .items-table td:last-child { text-align: right; width: 60px; }
    .totals td { padding: 1px 0; font-size: 10px; }
    .totals td:last-child { text-align: right; }
    .totals .total-row td { font-size: 13px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <!-- Business Header -->
  <div class="center bold large">${businessName}</div>
  ${address ? `<div class="center small">${address}</div>` : ''}
  ${phone ? `<div class="center small">Tel: ${phone}</div>` : ''}
  <div class="double-line"></div>

  <!-- Order Info -->
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div class="medium bold">PEDIDO #${orderId}</div>
    <div class="badge">${deliveryLabel}</div>
  </div>
  <div class="small" style="margin-top:2px">${date}</div>
  <div class="small bold">${order.cliente_nombre}</div>
  <div class="small">${order.cliente_telefono}</div>
  <div class="line"></div>

  <!-- Items -->
  <div class="small bold" style="margin-bottom:3px">ITEMS:</div>
  <table class="items-table">
    ${itemsHtml}
  </table>
  <div class="line"></div>

  <!-- Financial Summary -->
  <table class="totals">
    <tr><td>Subtotal:</td><td>$${subtotal.toFixed(2)}</td></tr>
    ${shipping > 0 ? `<tr><td>Envio:</td><td>$${shipping.toFixed(2)}</td></tr>` : ''}
    ${discount > 0 ? `<tr><td>Descuento${order.cupon_codigo ? ` (${order.cupon_codigo})` : ''}:</td><td>-$${discount.toFixed(2)}</td></tr>` : ''}
    <tr><td>IVA (16%):</td><td>$${iva.toFixed(2)}</td></tr>
    <tr class="total-row"><td>TOTAL:</td><td>$${order.total_usd?.toFixed(2)}</td></tr>
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
  <div style="margin-top:3px">
    <div class="xsmall">DIRECCION:</div>
    <div class="small">${order.direccion_envio}</div>
    ${order.distancia_km ? `<div class="xsmall">Distancia: ${order.distancia_km.toFixed(1)} km</div>` : ''}
  </div>` : ''}
  <div class="double-line"></div>

  <!-- Footer -->
  <div class="center small bold">Gracias por su compra!</div>
  <div class="center xsmall" style="margin-top:2px">Market Coffee Sweet</div>

  <!-- QR Code Area -->
  <!-- QR code would be generated here -->
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.print();
}
