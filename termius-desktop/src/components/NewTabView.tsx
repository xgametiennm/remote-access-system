import React, { useState } from 'react';
import { SavedHost } from '../types';
import { Server, Search } from 'lucide-react';

interface NewTabViewProps {
  hosts: SavedHost[];
  onSelectHost: (host: SavedHost) => void;
  onQuickConnect: (target: string) => void;
}

export const NewTabView: React.FC<NewTabViewProps> = ({
  hosts,
  onSelectHost,
  onQuickConnect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="new-tab-view-container">
      {/* Search hosts or tabs bar */}
      <div className="new-tab-search-wrapper">
        <form className="new-tab-search-box" onSubmit={handleSearchSubmit}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            className="new-tab-search-input"
            placeholder="Search hosts or tabs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <span className="keyboard-shortcut-tag">Ctrl+K</span>
        </form>
      </div>

      {/* Main Content White Card */}
      <div className="recent-connections-card">
        {/* Card Header */}
        <div className="recent-card-header">
          <h3 className="recent-title">Recent connections</h3>
          <div className="recent-actions">
            <button className="recent-action-btn">Create a workspace</button>
            <button className="recent-action-btn">Restore</button>
          </div>
        </div>

        {/* Recent Connections Host List */}
        <div className="recent-host-list">
          {filteredHosts.map((host) => {
            const isOrangeIcon = !host.group || host.group.toLowerCase().includes('prod') || host.group.toLowerCase().includes('staging');

            return (
              <div
                key={host.id}
                className="recent-host-row"
                onClick={() => onSelectHost(host)}
              >
                <div className={`row-os-badge ${isOrangeIcon ? 'ubuntu' : 'server'}`}>
                  <Server size={14} />
                </div>

                <div className="row-host-name">
                  {host.ip} {host.name ? `- ${host.name}` : ''}
                </div>

                <div className="row-tag-badge">Personal</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
