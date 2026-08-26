import React, { useState, useRef } from 'react';
import { uploadImage } from '../../../store/storageService';
import { useToast } from '../../../components/Toast';
import { Image, Upload, Link, X } from 'lucide-react';

interface ImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  maxSize?: number;
  previewSize?: 'sm' | 'md' | 'lg';
}

const ImageField: React.FC<ImageFieldProps> = ({
  value,
  onChange,
  bucket = 'settings',
  folder = 'uploads',
  label,
  maxSize = 800,
  previewSize = 'md',
}) => {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const previewSizes = { sm: 'w-10 h-10', md: 'w-16 h-16', lg: 'w-24 h-24' };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, bucket, folder, { maxWidth: maxSize });
      onChange(url);
      setUrlInput(url);
    } catch (err: unknown) {
      showToast('error', 'Error al subir imagen: ' + (err instanceof Error ? err.message : String(err)));
    }
    setUploading(false);
    if (e.target) e.target.value = '';
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-xs font-bold" style={{ color: 'var(--ios-text-secondary)' }}>{label}</span>}

      <div className="flex items-start gap-3">
        {/* Preview */}
        {value ? (
          <div className="relative shrink-0">
            <img
              src={value}
              alt={label || 'Preview'}
              className={`${previewSizes[previewSize]} rounded-xl object-cover`}
              style={{ border: '2px solid var(--ios-border)' }}
            />
            <button
              onClick={handleClear}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: '#FF3B30', color: 'white' }}
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div
            className={`${previewSizes[previewSize]} rounded-xl flex items-center justify-center shrink-0`}
            style={{ background: 'var(--ios-bg)', border: '2px dashed var(--ios-border)' }}
          >
            <Image size={previewSize === 'sm' ? 14 : previewSize === 'md' ? 20 : 28} style={{ color: 'var(--ios-text-tertiary)' }} />
          </div>
        )}

        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* URL Input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlApply()}
              className="admin-input flex-1 text-xs"
              placeholder="Pega URL de imagen..."
            />
            <button
              onClick={handleUrlApply}
              disabled={!urlInput.trim() || urlInput === value}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
              style={{ background: 'var(--ios-bg)', color: 'var(--ios-text-secondary)', border: '1px solid var(--ios-border)' }}
            >
              <Link size={12} /> Usar
            </button>
          </div>

          {/* File Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="admin-btn flex items-center justify-center gap-2 text-xs py-2 cursor-pointer"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--ios-text-tertiary)' }}>
        Se convierte automáticamente a WebP. Formatos: JPG, PNG, WebP
      </p>
    </div>
  );
};

export default ImageField;
