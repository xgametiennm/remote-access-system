import React, { useState } from 'react';
import { SavedHost } from '../types';
import {
  Server,
  Key,
  ArrowLeftRight,
  Code,
  ShieldAlert,
  Clock,
  Plus,
  Terminal,
  Radio,
  Grid,
  Tag,
  ChevronDown,
  Search,
  Pencil,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';

interface VaultsViewProps {
  hosts: SavedHost[];
  onSelectHost: (host: SavedHost) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (host: SavedHost) => void;
  onDeleteHost: (id: string) => void;
  onImportHosts: (importedHosts: SavedHost[]) => void;
  onQuickConnect: (target: string) => void;
}

export const VaultsView: React.FC<VaultsViewProps> = ({
  hosts,
  onSelectHost,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteHost,
  onImportHosts,
  onQuickConnect,
}) => {
  const [activeNav, setActiveNav] = useState<'hosts' | 'keychain' | 'port' | 'snippets' | 'known' | 'logs'>('hosts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);

  const filteredHosts = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.group && h.group.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onQuickConnect(searchQuery.trim());
    }
  };

  const handleExportClick = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(hosts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `termius_hosts_export_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            onImportHosts(parsed);
            alert(`[✔] Successfully imported ${parsed.length} hosts into Vaults!`);
          } else {
            alert('[-] Invalid format: File must contain a JSON array of hosts.');
          }
        } catch (err) {
          alert('[-] Failed to parse JSON file. Please check file format.');
        }
      };
    }
  };

  return (
    <div className="vaults-container">
      {/* Left Navigation Sidebar */}
      <nav className="vaults-sidebar">
        <div
          className={`nav-item ${activeNav === 'hosts' ? 'active' : ''}`}
          onClick={() => setActiveNav('hosts')}
        >
          <Server size={18} />
          <span>Hosts</span>
        </div>
        <div
          className={`nav-item ${activeNav === 'keychain' ? 'active' : ''}`}
          onClick={() => setActiveNav('keychain')}
        >
          <Key size={18} />
          <span>Keychain</span>
        </div>
        <div
          className={`nav-item ${activeNav === 'port' ? 'active' : ''}`}
          onClick={() => setActiveNav('port')}
        >
          <ArrowLeftRight size={18} />
          <span>Port Forwarding</span>
        </div>
        <div
          className={`nav-item ${activeNav === 'snippets' ? 'active' : ''}`}
          onClick={() => setActiveNav('snippets')}
        >
          <Code size={18} />
          <span>Snippets</span>
        </div>
        <div
          className={`nav-item ${activeNav === 'known' ? 'active' : ''}`}
          onClick={() => setActiveNav('known')}
        >
          <ShieldAlert size={18} />
          <span>Known Hosts</span>
        </div>
        <div
          className={`nav-item ${activeNav === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveNav('logs')}
        >
          <Clock size={18} />
          <span>Logs</span>
        </div>
      </nav>

      {/* Vaults Main Content */}
      <div className="vaults-main">
        {/* Top Search / Address Bar */}
        <div className="vaults-search-bar">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Find a host or ssh user@hostname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              className={`connect-action-btn ${searchQuery.trim().length > 0 ? 'active' : ''}`}
            >
              Connect
            </button>
          </form>
        </div>

        {/* Action Toolbar */}
        <div className="vaults-toolbar">
          <div className="toolbar-left">
            <button className="new-host-btn" onClick={onOpenAddModal}>
              <Plus size={16} /> New host <ChevronDown size={14} />
            </button>

            <button className="new-host-btn" onClick={handleExportClick} title="Export hosts to JSON file">
              <Download size={15} /> Export
            </button>

            <label className="new-host-btn" style={{ cursor: 'pointer' }} title="Import hosts from JSON file">
              <Upload size={15} /> Import
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
            </label>

            <div className="toggle-group">
              <button className="toggle-btn active">
                <Terminal size={15} /> Terminal
              </button>
              <button className="toggle-btn">
                <Radio size={15} /> Serial
              </button>
            </div>
          </div>

          <div className="toolbar-right">
            <button className="icon-btn active" title="Grid View">
              <Grid size={16} />
            </button>
            <button className="icon-btn" title="Tags">
              <Tag size={16} />
            </button>
          </div>
        </div>

        {/* Hosts Grid Section */}
        <div className="vaults-content">
          <h2 className="section-title">Hosts ({filteredHosts.length})</h2>

          {filteredHosts.length === 0 ? (
            <div className="empty-hosts-state">
              <Server size={48} color="#94a3b8" />
              <p>No hosts found.</p>
              <button className="new-host-btn" onClick={onOpenAddModal} style={{ marginTop: '0.5rem' }}>
                <Plus size={16} /> Add Your First Host
              </button>
            </div>
          ) : (
            <div className="hosts-grid">
              {filteredHosts.map((host) => {
                const isSelected = selectedHostId === host.id;
                const isOrangeIcon = !host.group || host.group.toLowerCase().includes('prod') || host.group.toLowerCase().includes('staging');

                return (
                  <div
                    key={host.id}
                    className={`vault-host-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedHostId(host.id)}
                    onDoubleClick={() => onSelectHost(host)}
                  >
                    <div className={`os-badge ${isOrangeIcon ? 'ubuntu' : 'server'}`}>
                      <Server size={18} />
                    </div>

                    <div className="card-info">
                      <div className="card-title">
                        {host.ip} {host.name ? `- ${host.name}` : ''}
                      </div>
                      <div className="card-subtitle">
                        ssh, telnet, {host.group ? host.group.toLowerCase() : 'root'}
                      </div>
                    </div>

                    {/* Card Actions: Edit & Delete */}
                    <div className="card-actions">
                      <button
                        className="card-action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditModal(host);
                        }}
                        title="Edit Host"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="card-action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHost(host.id);
                        }}
                        title="Delete Host"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
