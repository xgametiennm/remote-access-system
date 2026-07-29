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
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  Download,
  Upload,
  Folder,
  FolderOpen,
  Layers,
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
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filter hosts by search query and optional group filter
  const filteredHosts = hosts.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.group && h.group.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGroup =
      !selectedGroupFilter || (h.group || 'Unassigned').toLowerCase() === selectedGroupFilter.toLowerCase();

    return matchesSearch && matchesGroup;
  });

  // Group hosts by group name
  const groupedHosts = filteredHosts.reduce<Record<string, SavedHost[]>>((acc, host) => {
    const groupName = host.group && host.group.trim() ? host.group.trim() : 'Unassigned';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(host);
    return acc;
  }, {});

  const allGroups = Array.from(new Set(hosts.map((h) => (h.group && h.group.trim() ? h.group.trim() : 'Unassigned'))));

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

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

  const renderHostCard = (host: SavedHost) => {
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
            {host.authType === 'password'
              ? `ssh password (${host.username || 'root'}@${host.port})`
              : `agent direct (port ${host.port})`}{' '}
            • {host.group ? host.group.toLowerCase() : 'root'}
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
          <span>Hosts ({hosts.length})</span>
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

        {/* Groups Filter Sidebar Section */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', padding: '0 0.5rem 0.5rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Groups / Phân Nhóm
          </div>

          <div
            className={`nav-item ${selectedGroupFilter === null ? 'active' : ''}`}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => setSelectedGroupFilter(null)}
          >
            <Layers size={14} />
            <span>Tất cả ({hosts.length})</span>
          </div>

          {allGroups.map((gName) => {
            const count = hosts.filter((h) => (h.group || 'Unassigned').toLowerCase() === gName.toLowerCase()).length;
            const isSelected = selectedGroupFilter?.toLowerCase() === gName.toLowerCase();
            return (
              <div
                key={gName}
                className={`nav-item ${isSelected ? 'active' : ''}`}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', justifyContent: 'space-between' }}
                onClick={() => setSelectedGroupFilter(gName)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <Folder size={14} color={isSelected ? '#38bdf8' : '#94a3b8'} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gName}</span>
                </div>
                <span style={{ fontSize: '0.7rem', background: isSelected ? '#0284c7' : 'rgba(255,255,255,0.1)', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '10px' }}>
                  {count}
                </span>
              </div>
            );
          })}
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

            {/* View Mode Toggle: Grouped vs Flat Grid */}
            <div className="toggle-group">
              <button
                className={`toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setViewMode('grouped')}
                title="Hiển thị theo Phân Nhóm (Grouped View)"
              >
                <FolderOpen size={15} /> Phân nhóm
              </button>

              <button
                className={`toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
                onClick={() => setViewMode('flat')}
                title="Hiển thị Tất cả (Flat Grid View)"
              >
                <Grid size={15} /> Tất cả
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

        {/* Hosts Content Section */}
        <div className="vaults-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {selectedGroupFilter ? `Group: ${selectedGroupFilter}` : 'Hosts'} ({filteredHosts.length})
            </h2>

            {selectedGroupFilter && (
              <button
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#38bdf8',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                onClick={() => setSelectedGroupFilter(null)}
              >
                Show All Groups
              </button>
            )}
          </div>

          {filteredHosts.length === 0 ? (
            <div className="empty-hosts-state" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Server size={48} color="#94a3b8" />
              <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>No hosts found.</p>
              <button className="new-host-btn" onClick={onOpenAddModal} style={{ margin: '0.75rem auto 0 auto' }}>
                <Plus size={16} /> Add Your First Host
              </button>
            </div>
          ) : viewMode === 'grouped' ? (
            /* GROUPED VIEW: Render Collapsible Group Sections */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Object.entries(groupedHosts).map(([groupName, groupHostsList]) => {
                const isCollapsed = collapsedGroups[groupName] || false;

                return (
                  <div
                    key={groupName}
                    style={{
                      background: '#101624',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Collapsible Group Header Bar */}
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#161e30',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                      onClick={() => toggleGroupCollapse(groupName)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {isCollapsed ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#38bdf8" />}
                        <Folder size={18} color="#0284c7" />
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#e6edf3' }}>
                          {groupName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'rgba(2, 132, 199, 0.2)',
                            color: '#38bdf8',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '10px',
                            border: '1px solid rgba(2, 132, 199, 0.3)',
                          }}
                        >
                          {groupHostsList.length} {groupHostsList.length === 1 ? 'host' : 'hosts'}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {isCollapsed ? 'Click to Expand' : 'Click to Collapse'}
                      </span>
                    </div>

                    {/* Group Hosts Grid */}
                    {!isCollapsed && (
                      <div style={{ padding: '1rem' }}>
                        <div className="hosts-grid">
                          {groupHostsList.map(renderHostCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT GRID VIEW: Render All Hosts in Single Grid */
            <div className="hosts-grid">
              {filteredHosts.map(renderHostCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
