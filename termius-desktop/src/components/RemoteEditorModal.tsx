import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Loader2 } from 'lucide-react';

interface RemoteEditorModalProps {
  isOpen: boolean;
  filePath: string;
  initialContent: string;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (path: string, newContent: string) => void;
}

export const RemoteEditorModal: React.FC<RemoteEditorModalProps> = ({
  isOpen,
  filePath,
  initialContent,
  isLoading,
  isSaving,
  onClose,
  onSave,
}) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, isOpen]);

  if (!isOpen) return null;

  const fileName = filePath.split('/').pop() || filePath;

  const handleSave = () => {
    onSave(filePath, content);
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{
          width: '850px',
          maxWidth: '92vw',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            marginBottom: '0.85rem',
            paddingBottom: '0.65rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
            <FileText size={20} color="#38bdf8" />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e6edf3' }}>
                Editing: {fileName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filePath}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: isSaving || isLoading ? 'not-allowed' : 'pointer',
                opacity: isSaving || isLoading ? 0.7 : 1,
              }}
              onClick={handleSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaving ? 'Saving...' : 'Save to Server'}</span>
            </button>

            <button
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body / Code Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {isLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: '#94a3b8',
              }}
            >
              <Loader2 size={32} className="animate-spin" color="#0284c7" />
              <span>Fetching remote file content...</span>
            </div>
          ) : (
            <textarea
              style={{
                flex: 1,
                width: '100%',
                background: '#0d111a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#00e676',
                fontFamily: "'Fira Code', 'Consolas', monospace",
                fontSize: '0.88rem',
                lineHeight: '1.5',
                padding: '0.85rem',
                outline: 'none',
                resize: 'none',
                tabSize: 2,
              }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Remote file is empty."
            />
          )}
        </div>

        {/* Status Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.65rem',
            paddingTop: '0.4rem',
            fontSize: '0.75rem',
            color: '#94a3b8',
          }}
        >
          <span>Lines: {content.split('\n').length} | Characters: {content.length}</span>
          <span>Press ESC or click Cancel to close</span>
        </div>
      </div>
    </div>
  );
};
