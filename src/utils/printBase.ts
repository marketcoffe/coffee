/**
 * Shared base for all thermal ticket printing.
 * Centralizes @page CSS, body dimensions, and window.print() logic
 * so 58mm / 80mm paper switching is consistent everywhere.
 */

export type PaperSize = '58mm' | '80mm';

interface PaperDims {
  /** @page width value (e.g. '58mm') */
  pageWidth: string;
  /** body width in mm (e.g. '48mm') */
  bodyWidth: string;
  /** usable content width in mm (body - padding) */
  contentWidth: string;
  /** base font size for body */
  fontSize: string;
  /** font sizes relative to base */
  sizes: {
    tiny: string;
    xsmall: string;
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  };
}

export function getPaperDimensions(paperSize: PaperSize = '58mm'): PaperDims {
  if (paperSize === '80mm') {
    return {
      pageWidth: '80mm',
      bodyWidth: '78mm',
      contentWidth: '74mm',
      fontSize: '10px',
      sizes: { tiny: '7px', xsmall: '8px', small: '9px', medium: '10px', large: '13px', xlarge: '16px' },
    };
  }
  return {
    pageWidth: '58mm',
    bodyWidth: '48mm',
    contentWidth: '44mm',
    fontSize: '9px',
    sizes: { tiny: '6px', xsmall: '7px', small: '8px', medium: '9px', large: '12px', xlarge: '14px' },
  };
}

export function getPrintPageCss(paperSize: PaperSize = '58mm'): string {
  const d = getPaperDimensions(paperSize);
  return `
    @page { margin: 0; size: ${d.pageWidth} auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${d.fontSize};
      font-weight: bold;
      width: ${d.bodyWidth};
      padding: 2mm;
      color: #000;
      line-height: 1.3;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: ${d.sizes.large}; letter-spacing: 1px; }
    .medium { font-size: ${d.sizes.medium}; }
    .small { font-size: ${d.sizes.small}; }
    .xsmall { font-size: ${d.sizes.xsmall}; }
    .tiny { font-size: ${d.sizes.tiny}; }
    .line { border-top: 1px dashed #000; margin: 3px 0; }
    .double-line { border-top: 2px solid #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .item-row td { font-size: ${d.sizes.medium}; font-weight: bold; padding: 2px 0; }
    .totals td { padding: 1px 0; font-size: ${d.sizes.small}; }
    .totals td:last-child { text-align: right; }
    .totals .total-row td { font-size: ${d.sizes.large}; font-weight: bold; border-top: 1px solid #000; padding-top: 2px; }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 2px 6px;
      font-size: ${d.sizes.tiny};
      font-weight: bold;
      letter-spacing: 1px;
    }
  `;
}

/**
 * Open a new window, write thermal ticket HTML, and trigger print.
 * Returns the window handle (or null if blocked by popup blocker).
 */
export function printThermalTicket(
  title: string,
  bodyHtml: string,
  paperSize: PaperSize = '58mm',
): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;

  const css = getPrintPageCss(paperSize);

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.print();
  return w;
}
