import React from 'react';
import { SavedHost } from '../types';
import { Server, Trash2, Globe } from 'lucide-react';

interface ServerSidebarProps {
  hosts: SavedHost[];
  onSelectHost: (host: SavedHost) => void;
  onDeleteHost: (id: string, e: React.MouseEvent) => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  hosts,
  onSelectHost,
  onDeleteHost,
}) => {
  return (
    <aside className="inventory-sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <Server size={18} color="#06b6d4" /> Server Inventory
        </div>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{hosts.length} Hosts</span>
      </div>

      <div className="host-list">
        {hosts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 1rem', fontSize: '0.82rem' }}>
            <Globe size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p>No saved hosts yet.</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Click "+ New Host" to save server IP & port.</p>
          </div>
        ) : (
          hosts.map((host) => (
            <div key={host.id} className="host-card" onClick={() => onSelectHost(host)}>
              <div className="host-name">
                <span>{host.name}</span>
                <button
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}
                  onClick={(e) => onDeleteHost(host.id, e)}
                  title="Delete Host"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="host-address">
                {host.ip}:{host.port}
              </div>
              {host.group && <span className="host-tag">{host.group}</span>}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
