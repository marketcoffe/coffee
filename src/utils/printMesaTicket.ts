import { Order } from '../types/store';

export function printMesaTicket(order: Order, config: any) {
  const w = window.open('', '_blank');
  if (!w) return;

  const businessName = config?.site_nombre || 'MARKET COFFEE SWEET';
  const address = config?.direccion_fisica || '';
  const phone = config?.telefono_soporte || '';
  const date = new Date(order.fecha).toLocaleString('es-VE');
  const orderId = order.id.slice(-8);
  const mesaNum = order.numero_mesa || '?';
  const clientName = order.nombre_cliente || order.cliente_nombre || 'Cliente';
  const paymentMethod = order.metodo_pago || 'N/A';
  const paymentRef = order.referencia_pago || '';
  const bankOrigin = order.banco_origen || '';

  const subtotal = order.subtotal_usd || order.total_usd;
  const shipping = order.costo_envio_usd || 0;
  const discount = order.descuento_cupon_usd || 0;

  let itemsHtml = '';
  order.items?.forEach(item => {
    const optStr = item.selected_options?.length
      ? `<div style="font-size:8px;color:#666;margin-left:6px">${item.selected_options.map(o => o.option_name).join(', ')}</div>`
      : '';
    const removedStr = item.ingredientes_removidos?.length
      ? `<div style="font-size:8px;color:#c00;margin-left:6px;text-decoration:line-through">Sin: ${item.ingredientes_removidos.join(', ')}</div>`
      : '';
    const itemTotal = ((item.precio_usd + (item.options_total_usd || 0)) * item.cantidad).toFixed(2);
    itemsHtml += `
      <tr>
        <td style="width:24px;text-align:center;font-weight:bold;font-size:9px">${item.cantidad}x</td>
        <td style="font-size:9px">
          ${item.nombre}
          ${optStr}
          ${removedStr}
        </td>
        <td style="text-align:right;width:50px;font-weight:bold;font-size:9px">$${itemTotal}</td>
      </tr>`;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Mesa #${mesaNum} - ${orderId}</title>
  <style>
    @page { margin: 0; size: 58mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      width: 48mm;
      padding: 2mm;
      color: #000;
      line-height: 1.3;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 13px; letter-spacing: 1px; }
    .medium { font-size: 10px; }
    .small { font-size: 9px; }
    .xsmall { font-size: 7px; }
    .line { border-top: 1px dashed #000; margin: 3px 0; }
    .double-line { border-top: 2px solid #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .totals td { padding: 1px 0; font-size: 9px; }
    .totals td:last-child { text-align: right; }
    .totals .total-row td { font-size: 11px; font-weight: bold; border-top: 1px solid #000; padding-top: 2px; }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 2px 6px;
      font-size: 9px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .mesa-badge {
      display: inline-block;
      background: #000;
      color: #fff;
      padding: 3px 8px;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <!-- Business Header -->
  <div class="center bold large">${businessName}</div>
  ${address ? `<div class="center xsmall">${address}</div>` : ''}
  ${phone ? `<div class="center xsmall">Tel: ${phone}</div>` : ''}
  <div class="double-line"></div>

  <!-- Order Info -->
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div class="medium bold">PEDIDO #${orderId}</div>
    <div class="badge">MESA</div>
  </div>
  <div class="center" style="margin:4px 0">
    <div class="mesa-badge">MESA #${mesaNum}</div>
  </div>
  <div class="xsmall" style="margin-top:2px">${date}</div>
  <div class="small bold">${clientName}</div>
  <div class="line"></div>

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
    <tr class="total-row"><td>TOTAL:</td><td>$${order.total_usd?.toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>

  <!-- Payment Info -->
  <div style="display:flex;justify-content:space-between">
    <div>
      <div class="xsmall">PAGO</div>
      <div class="small bold">${paymentMethod}</div>
    </div>
    <div style="text-align:right">
      <div class="xsmall">MESA</div>
      <div class="small bold">#${mesaNum}</div>
    </div>
  </div>
  ${paymentRef ? `
  <div style="margin-top:2px">
    <div class="xsmall">REF: ${paymentRef}</div>
    ${bankOrigin ? `<div class="xsmall">BANCO: ${bankOrigin}</div>` : ''}
  </div>` : ''}
  <div class="double-line"></div>

  <!-- Status -->
  <div class="center bold" style="font-size:9px; letter-spacing:1px; padding:3px 0; border:1px solid #000;">
    PENDIENTE VERIFICACION
  </div>
  <div class="double-line"></div>

  <!-- Footer -->
  <div class="center small bold">Gracias por preferirnos!</div>
  <div class="center xsmall" style="margin-top:1px">Market Coffee Sweet</div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.print();
}
