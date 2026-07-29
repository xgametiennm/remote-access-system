import React, { useState, useEffect } from 'react';
import { X, Server } from 'lucide-react';
import { SavedHost } from '../types';

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hostData: Omit<SavedHost, 'id' | 'createdAt'>, hostId?: string) => void;
  initialHost?: SavedHost | null;
}

export const ServerModal: React.FC<ServerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHost,
}) => {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(23);
  const [group, setGroup] = useState('root');

  useEffect(() => {
    if (initialHost) {
      setName(initialHost.name || '');
      setIp(initialHost.ip || '');
      setPort(initialHost.port || 23);
      setGroup(initialHost.group || 'root');
    } else {
      setName('');
      setIp('');
      setPort(23);
      setGroup('root');
    }
  }, [initialHost, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip) return;
    onSave({ name, ip, port, group }, initialHost?.id);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Server size={18} color="#0284c7" />
            <span>{initialHost ? 'Edit Host Settings' : 'Add New Host'}</span>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">IP Address / Domain Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 46.225.58.185 or myserver.com"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Host Alias / Label (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. staging v2 or Production DB"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Remote Agent Port</label>
            <input
              type="number"
              className="form-input"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 23)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">SSH User / Group Tag</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. root, xgame, step, prod"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="connect-action-btn" style={{ background: '#0284c7', color: '#fff', padding: '0.5rem 1.25rem' }}>
              {initialHost ? 'Save Changes' : 'Add Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
