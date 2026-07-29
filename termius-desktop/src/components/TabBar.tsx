import React from 'react';
import { TabSession, SavedHost } from '../types';
import {
  Cloud,
  Folder,
  X,
  Plus,
  Minus,
  Square,
} from 'lucide-react';

interface TabBarProps {
  sessions: TabSession[];
  activeTabId: string;
  savedHosts: SavedHost[];
  isNewTabOpen: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onCloseNewTab: (e: React.MouseEvent) => void;
  onSelectHost: (host: SavedHost) => void;
  onOpenNewTab: () => void;
  onOpenAddModal: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  sessions,
  activeTabId,
  isNewTabOpen,
  onSelectTab,
  onCloseTab,
  onCloseNewTab,
  onOpenNewTab,
}) => {
  return (
    <div className="top-tab-bar">
      <div className="tab-list">
        {/* Vaults Fixed Tab (Always Present) */}
        <div
          className={`top-tab-item vaults-tab ${activeTabId === 'vaults' ? 'active' : ''}`}
          onClick={() => onSelectTab('vaults')}
        >
          <Cloud size={15} />
          <span>Vaults</span>
        </div>

        {/* SFTP Fixed Tab (Always Present) */}
        <div
          className={`top-tab-item sftp-tab ${activeTabId === 'sftp' ? 'active' : ''}`}
          onClick={() => onSelectTab('sftp')}
        >
          <Folder size={15} />
          <span>SFTP</span>
        </div>

        {/* Session Tabs */}
        {sessions.map((session) => {
          const isActive = session.id === activeTabId;
          return (
            <div
              key={session.id}
              className={`top-tab-item session-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(session.id)}
            >
              <span className="tab-os-badge">T</span>
              <span className="tab-title">{session.title}</span>
              <button
                className="tab-close-btn"
                onClick={(e) => onCloseTab(session.id, e)}
                title="Close Tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* New Tab (Displayed when user clicks '+') */}
        {isNewTabOpen && (
          <div
            className={`top-tab-item new-tab-item ${activeTabId === 'new-tab' ? 'active' : ''}`}
            onClick={() => onSelectTab('new-tab')}
          >
            <button
              className="tab-close-btn"
              onClick={onCloseNewTab}
              title="Close New Tab"
              style={{ marginRight: '2px' }}
            >
              <X size={12} />
            </button>
            <span>New Tab</span>
          </div>
        )}

        {/* '+' Button to Add New Tab */}
        <button
          className="add-terminal-tab-btn"
          onClick={onOpenNewTab}
          title="New Tab"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Window Controls */}
      <div className="window-controls">
        <button className="win-btn" title="Minimize">
          <Minus size={13} />
        </button>
        <button className="win-btn" title="Maximize">
          <Square size={11} />
        </button>
        <button className="win-btn close" title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
