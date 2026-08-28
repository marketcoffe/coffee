import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Shield, Clock, Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { requestWhatsAppReset, buildWhatsAppRecoveryURL } from '../security/authService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  supportPhone?: string;
}

type Step = 'input' | 'generating' | 'result' | 'error';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  themeColor,
  supportPhone = '+584123758879',
}) => {
  const [step, setStep] = useState<Step>('input');
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [userId, setUserId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setStep('generating');
    setErrorMessage('');

    const result = await requestWhatsAppReset(identifier.trim());

    if (!result.success) {
      setErrorMessage(result.error || 'Error al generar código.');
      setStep('error');
      return;
    }

    if (result.token) {
      setToken(result.token);
      setUserName(result.user_nombre || '');
      setExpiresAt(result.expires_at || '');
      setUserId(result.user_id || '');
      setStep('result');
    } else {
      setErrorMessage(result.message || 'Si el correo está registrado, recibirás instrucciones.');
      setStep('error');
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const url = buildWhatsAppRecoveryURL(supportPhone, token, userName);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleClose = () => {
    setStep('input');
    setIdentifier('');
    setToken('');
    setUserName('');
    setExpiresAt('');
    setUserId('');
    setErrorMessage('');
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="w-full max-w-[380px] bg-white rounded-[28px] shadow-2xl overflow-hidden mb-16 sm:mb-0"
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <X size={16} className="text-zinc-500" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: themeColor + '15', color: themeColor }}
              >
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                  Recuperar Contraseña
                </h3>
                <p className="text-[11px] text-zinc-500">Vía WhatsApp — sin email</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            {/* STEP: Input */}
            {step === 'input' && (
              <form onSubmit={handleGenerateToken} className="flex flex-col gap-3">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ingresa tu correo electrónico o nombre de usuario. Se generará un código de 6 dígitos que deberás enviar por WhatsApp para verificar tu identidad.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Email o Usuario
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="tu@email.com o usuario"
                    className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-400 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!identifier.trim()}
                  className="w-full font-bold py-3 rounded-xl text-xs uppercase tracking-wider text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: themeColor }}
                >
                  Generar Código de Recuperación
                </button>
              </form>
            )}

            {/* STEP: Generating */}
            {step === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 size={28} className="animate-spin" style={{ color: themeColor }} />
                <p className="text-sm text-zinc-600">Generando código seguro...</p>
              </div>
            )}

            {/* STEP: Result */}
            {step === 'result' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-xs text-green-700 font-semibold">
                    Código generado para <strong>{userName}</strong>
                  </p>
                  {expiresAt && (
                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      Válido por 15 minutos
                    </p>
                  )}
                </div>

                {/* Token Display */}
                <div className="flex flex-col items-center gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Tu código de verificación
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-3xl font-mono font-black tracking-[0.3em] select-all"
                      style={{ color: themeColor }}
                    >
                      {token}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="p-2 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
                      title="Copiar código"
                    >
                      {copied ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-zinc-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* WhatsApp Button */}
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer"
                >
                  <MessageSquare size={18} />
                  Enviar por WhatsApp
                </button>

                <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                  Al enviar, nuestro equipo validará tu código y generará tu nueva contraseña.
                </p>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full text-center text-[11px] text-zinc-400 hover:text-zinc-600 font-medium py-1 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* STEP: Error */}
            {step === 'error' && (
              <div className="flex flex-col gap-3 py-4">
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">{errorMessage}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="w-full font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Intentar de Nuevo
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full text-center text-[11px] text-zinc-400 hover:text-zinc-600 font-medium py-1 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
