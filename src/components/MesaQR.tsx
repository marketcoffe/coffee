import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';

interface MesaQRProps {
  mesaNumero: number;
  baseUrl: string;
  themeColor?: string;
  nombrePersonalizado?: string;
}

export const MesaQR: React.FC<MesaQRProps> = ({ mesaNumero, baseUrl, themeColor = '#e67e22', nombrePersonalizado }) => {
  const qrUrl = `${baseUrl}/?mesa=${mesaNumero}`;
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svgEl = canvasRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 500);

      ctx.fillStyle = '#1a1c1d';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Mesa ${mesaNumero}`, 200, 40);

      if (nombrePersonalizado) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#8f7065';
        ctx.fillText(nombrePersonalizado, 200, 60);
      }

      const qrSize = 280;
      const qrX = (400 - qrSize) / 2;
      const qrY = nombrePersonalizado ? 75 : 55;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#8f7065';
      ctx.textAlign = 'center';
      ctx.fillText('Escanea para pedir', 200, qrY + qrSize + 30);
      ctx.font = '11px Arial';
      ctx.fillText(qrUrl, 200, qrY + qrSize + 50);

      const link = document.createElement('a');
      link.download = `mesa-${mesaNumero}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const svgEl = canvasRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Mesa ${mesaNumero} - QR</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;margin:0;padding:20px;">
        <h2 style="margin:0 0 4px">Mesa ${mesaNumero}</h2>
        ${nombrePersonalizado ? `<p style="margin:0 0 16px;color:#8f7065;font-size:14px">${nombrePersonalizado}</p>` : '<div style="height:16px"></div>'}
        <div style="transform:scale(2);transform-origin:center">${svgData}</div>
        <p style="margin-top:30px;font-size:12px;color:#8f7065">Escanea para pedir</p>
        <style>@media print{body{margin:0}}</style>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={canvasRef} className="bg-white p-3 rounded-xl border border-[#e4beb1]/10 inline-block">
        <QRCodeSVG
          value={qrUrl}
          size={140}
          bgColor="#ffffff"
          fgColor="#1a1c1d"
          level="H"
          includeMargin={false}
        />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
          style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
          title="Descargar QR"
        >
          <Download size={12} /> Descargar
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[#eeeef0] text-[#5b4137] hover:bg-[#ddd] transition-colors cursor-pointer"
          title="Imprimir QR"
        >
          <Printer size={12} /> Imprimir
        </button>
      </div>
    </div>
  );
};
