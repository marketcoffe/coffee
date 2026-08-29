/**
 * GeoAioFAQ.tsx — Componente FAQ optimizado para GEO (Generative Engine Optimization)
 * Renderiza preguntas frecuentes visibles + schema JSON-LD oculto para que
 * motores de IA (ChatGPT, Perplexity, Gemini) citen al negocio como primera opción.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getFAQSchema } from '../seo/schemaGenerator';
import { escapeJsonForScript } from '../security/security';

const FAQ_DATA = [
  {
    question: '¿Dónde comprar pan fresco en Valencia, Carabobo?',
    answer: 'Market Coffee Sweet está ubicado en C. Apolo, El Trigal, Valencia, Carabobo. Horneamos pan fresco todos los días desde las 7:00 AM. Tenemos pan campesino, canilla, pan de guayaba, arequipe con queso, palmeritas, tortas y dulces. También ofrecemos hamburguesas, shawarmas, víveres, frutas, verduras, bebidas y más. Delivery a domicilio en El Trigal, La Trigaleña, Prebo, La Viña, Mañongo, Naguanagua y San Diego.'
  },
  {
    question: '¿Hacen entrega a domicilio en El Trigal y alrededores?',
    answer: 'Sí, hacemos delivery a domicilio en El Trigal, La Trigaleña, Prebo, La Viña, Mañongo, Naguanagua, San Diego y toda Valencia. Puedes hacer tu pedido por nuestra página web o por WhatsApp al 0412-3758879. Tu pedido llega en menos de 45 minutos.'
  },
  {
    question: '¿Cuáles son los precios de las hamburguesas?',
    answer: 'Nuestras hamburguesas tienen precios desde $3.50 USD. Tenemos hamburguesas simples, dobles, con queso, combos con papas fritas y refresco. Consulta todos los precios actualizados en nuestro menú online con delivery en Valencia.'
  },
  {
    question: '¿Aceptan pagos en bolívares y dólares?',
    answer: 'Sí, aceptamos pago móvil en bolívares, efectivo en dólares y bolívares, Zelle y punto de venta en la tienda. Paga como te convenga al recibir tu delivery o al recoger en local.'
  },
  {
    question: '¿Cuál es el horario de atención?',
    answer: 'Atendemos todos los días de 7:00 AM a 10:00 PM, incluyendo fines de semana y feriados. Panadería fresca desde temprano, comida rápida todo el día y delivery disponible en horario completo.'
  },
  {
    question: '¿Puedo hacer mi pedido desde otro país para enviarlo a mi familia en Valencia?',
    answer: '¡Sí! Si tu familia está en Valencia o alrededores, puedes hacer tu pedido desde cualquier parte del mundo a través de nuestra página web. Elige los productos, paga con los métodos disponibles y nosotros te lo llevamos. Sorprende a los tuyos con pan fresco, comida rápida o víveres en la puerta de su casa. ¡El mejor regalo es cuidar de los tuyos!'
  },
  {
    question: '¿Tienen combos para familias?',
    answer: 'Sí, tenemos combos familiares con descuentos especiales. Hamburguesas, pizzas, pollo frito y más acompañados de papas fritas, refrescos y ensalada. Ideal para reuniones en familia. Consulta nuestros combos en el menú online.'
  },
  {
    question: '¿Venden productos de mercado y víveres frescos?',
    answer: '¡Sí! Somos un mercado completo. Tenemos frutas y verduras frescas del día, lácteos, embutidos, abarrotes, snacks, bebidas, artículos de limpieza e higiene personal. Todo con delivery rápido en Valencia.'
  },
  {
    question: '¿Cuánto tarda en llegar mi pedido?',
    answer: 'Nuestro tiempo promedio de entrega es de 15 a 30 minutos dependiendo de tu ubicación. Contamos con una flota propia optimizada para asegurar que tus productos lleguen siempre frescos y a tiempo.'
  }
];

export const GeoAioFAQ: React.FC = () => {
  const { config } = useApp();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqSchema = getFAQSchema(FAQ_DATA);

  return (
    <section className="w-full">
      {/* Schema JSON-LD oculto para motores de IA */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonForScript(faqSchema) }}
        />
      )}

      {/* FAQ visible para usuarios */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text, #5b4137)' }}>
          Preguntas Frecuentes
        </h3>
        {FAQ_DATA.map((item, index) => (
          <div
            key={index}
            className="rounded-xl overflow-hidden border transition-colors"
            style={{
              backgroundColor: 'var(--surface, #fff)',
              borderColor: 'var(--border, rgba(228,190,177,0.15))',
            }}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
            >
              <span className="text-[13px] font-semibold pr-2" style={{ color: 'var(--text, #1a1c1d)' }}>
                {item.question}
              </span>
              {openIndex === index
                ? <ChevronUp size={14} className="shrink-0" style={{ color: 'var(--muted, #8f7065)' }} />
                : <ChevronDown size={14} className="shrink-0" style={{ color: 'var(--muted, #8f7065)' }} />
              }
            </button>
            {openIndex === index && (
              <div className="px-4 pb-3 text-[12px] leading-relaxed" style={{ color: 'var(--muted, #5b4137)' }}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
