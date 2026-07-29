import React, { useState, useEffect } from 'react';
import { X, Server, Key, ShieldCheck } from 'lucide-react';
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
  const [authType, setAuthType] = useState<'agent' | 'password'>('agent');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [group, setGroup] = useState('root');

  useEffect(() => {
    if (initialHost) {
      setName(initialHost.name || '');
      setIp(initialHost.ip || '');
      setPort(initialHost.port || (initialHost.authType === 'password' ? 22 : 23));
      setAuthType(initialHost.authType || 'agent');
      setUsername(initialHost.username || 'root');
      setPassword(initialHost.password || '');
      setGroup(initialHost.group || 'root');
    } else {
      setName('');
      setIp('');
      setPort(23);
      setAuthType('agent');
      setUsername('root');
      setPassword('');
      setGroup('root');
    }
  }, [initialHost, isOpen]);

  if (!isOpen) return null;

  const handleAuthTypeChange = (type: 'agent' | 'password') => {
    setAuthType(type);
    if (type === 'password' && port === 23) {
      setPort(22);
    } else if (type === 'agent' && port === 22) {
      setPort(23);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip) return;
    onSave({ name, ip, port, authType, username, password, group }, initialHost?.id);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '480px' }}>
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
          {/* Auth Method Selector */}
          <div className="form-group">
            <label className="form-label">Authentication Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                className={`toggle-btn ${authType === 'agent' ? 'active' : ''}`}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: authType === 'agent' ? '1px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  justifyContent: 'center',
                  background: authType === 'agent' ? 'rgba(2, 132, 199, 0.15)' : '#0d111a',
                  color: authType === 'agent' ? '#38bdf8' : '#94a3b8',
                }}
                onClick={() => handleAuthTypeChange('agent')}
              >
                <ShieldCheck size={16} />
                <span>Agent Direct (Port 23)</span>
              </button>

              <button
                type="button"
                className={`toggle-btn ${authType === 'password' ? 'active' : ''}`}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: authType === 'password' ? '1px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  justifyContent: 'center',
                  background: authType === 'password' ? 'rgba(2, 132, 199, 0.15)' : '#0d111a',
                  color: authType === 'password' ? '#38bdf8' : '#94a3b8',
                }}
                onClick={() => handleAuthTypeChange('password')}
              >
                <Key size={16} />
                <span>SSH Password (Port 22)</span>
              </button>
            </div>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Host Alias / Label (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Production DB"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{authType === 'password' ? 'SSH Port' : 'Agent Port'}</label>
              <input
                type="number"
                className="form-input"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || (authType === 'password' ? 22 : 23))}
                required
              />
            </div>
          </div>

          {/* SSH Username & Password Fields (Only for authType === 'password') */}
          {authType === 'password' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#0d111a', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#38bdf8' }}>SSH Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="root"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#38bdf8' }}>SSH Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Group / Tag</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. root, prod, xgame"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="connect-action-btn active" style={{ background: '#0284c7', color: '#fff', padding: '0.5rem 1.25rem' }}>
              {initialHost ? 'Save Changes' : 'Add Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
