import React, { useState, useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { VaultsView } from './components/VaultsView';
import { NewTabView } from './components/NewTabView';
import { TerminalTab } from './components/TerminalTab';
import { SftpView } from './components/SftpView';
import { ServerModal } from './components/AddServerModal';
import { SavedHost, TabSession } from './types';
import { Folder } from 'lucide-react';

const INITIAL_HOSTS: SavedHost[] = [
  { id: 'h1', name: 'Carnival prod', ip: '5.75.157.95', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h2', name: 'tivi xtask', ip: '207.148.69.78', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h3', name: 'color blast prod v1', ip: '46.224.224.174', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h4', name: 'staging v1', ip: '103.214.9.138', port: 23, group: 'step', createdAt: new Date().toISOString() },
  { id: 'h5', name: 'game resource', ip: '91.98.67.112', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h6', name: 'catdom prod', ip: '178.104.39.66', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h7', name: '', ip: '192.168.1.97', port: 23, group: 'xgame', createdAt: new Date().toISOString() },
  { id: 'h8', name: 'color blast prod v2', ip: '91.99.181.232', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h9', name: 'staging v2', ip: '46.225.58.185', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h10', name: 'screw puzzle', ip: '66.42.63.205', port: 23, group: 'root', createdAt: new Date().toISOString() },
  { id: 'h11', name: 'drama max', ip: '45.32.100.214', port: 23, group: 'root', createdAt: new Date().toISOString() },
];

export default function App() {
  const [savedHosts, setSavedHosts] = useState<SavedHost[]>(() => {
    const local = localStorage.getItem('termius_saved_hosts');
    if (local) {
      try {
        const parsed: SavedHost[] = JSON.parse(local);
        if (parsed.length > 0) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_HOSTS;
  });

  const [sessions, setSessions] = useState<TabSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('vaults'); // 'vaults' | 'sftp' | 'new-tab' | session.id
  const [isNewTabOpen, setIsNewTabOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<SavedHost | null>(null);

  useEffect(() => {
    localStorage.setItem('termius_saved_hosts', JSON.stringify(savedHosts));
  }, [savedHosts]);

  const handleQuickConnect = (target: string) => {
    let ip = target;
    let port = 23;

    if (target.includes(':')) {
      const parts = target.split(':');
      ip = parts[0];
      port = parseInt(parts[1]) || 23;
    }

    createSession(`Server (${ip})`, ip, port);
  };

  // Allow creating multiple parallel SSH tab sessions for the SAME server
  const createSession = (
    title: string,
    ip: string,
    port: number,
    authType: 'agent' | 'password' = 'agent',
    username?: string,
    password?: string
  ) => {
    const sameIpSessions = sessions.filter((s) => s.ip === ip && s.port === port);
    const tabTitle = sameIpSessions.length > 0 ? `${title} (${sameIpSessions.length})` : title;

    const newSession: TabSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: tabTitle,
      ip,
      port,
      authType,
      username,
      password,
      connectedAt: new Date().toISOString(),
      status: 'connecting',
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveTabId(newSession.id);
    setIsNewTabOpen(false); // Close New Tab when session connects
  };

  const handleSelectHost = (host: SavedHost) => {
    const title = host.name ? `${host.ip} - ${host.name}` : host.ip;
    createSession(title, host.ip, host.port, host.authType || 'agent', host.username, host.password);
  };

  const handleOpenAddModal = () => {
    setEditingHost(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (host: SavedHost) => {
    setEditingHost(host);
    setIsModalOpen(true);
  };

  const handleSaveHost = (
    hostData: Omit<SavedHost, 'id' | 'createdAt'>,
    hostId?: string
  ) => {
    if (hostId) {
      setSavedHosts((prev) =>
        prev.map((h) => (h.id === hostId ? { ...h, ...hostData } : h))
      );
    } else {
      const newHost: SavedHost = {
        ...hostData,
        id: `host-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setSavedHosts((prev) => [...prev, newHost]);
    }
  };

  const handleDeleteHost = (id: string) => {
    setSavedHosts((prev) => prev.filter((h) => h.id !== id));
  };

  const handleImportHosts = (imported: SavedHost[]) => {
    setSavedHosts((prev) => {
      const newItems = imported.map((h, i) => ({
        ...h,
        id: h.id || `import-${Date.now()}-${i}`,
        createdAt: h.createdAt || new Date().toISOString(),
      }));
      const merged = [...prev];
      for (const item of newItems) {
        const foundIdx = merged.findIndex((m) => m.ip === item.ip && (m.port || 23) === (item.port || 23));
        if (foundIdx >= 0) {
          merged[foundIdx] = item;
        } else {
          merged.push(item);
        }
      }
      return merged;
    });
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : 'vaults');
      }
      return next;
    });
  };

  const handleCloseNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNewTabOpen(false);
    if (activeTabId === 'new-tab') {
      setActiveTabId(sessions.length > 0 ? sessions[sessions.length - 1].id : 'vaults');
    }
  };

  const handleOpenNewTab = () => {
    setIsNewTabOpen(true);
    setActiveTabId('new-tab');
  };

  const handleStatusChange = (id: string, status: 'connected' | 'disconnected') => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  return (
    <div className="termius-vaults-app">
      {/* Top Navigation & Session Tabs Bar */}
      <TabBar
        sessions={sessions}
        activeTabId={activeTabId}
        savedHosts={savedHosts}
        isNewTabOpen={isNewTabOpen}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onCloseNewTab={handleCloseNewTab}
        onSelectHost={handleSelectHost}
        onOpenNewTab={handleOpenNewTab}
        onOpenAddModal={handleOpenAddModal}
      />

      {/* Main Workspace Body */}
      <div className="main-workspace-area">
        {activeTabId === 'vaults' && (
          <VaultsView
            hosts={savedHosts}
            onSelectHost={handleSelectHost}
            onOpenAddModal={handleOpenAddModal}
            onOpenEditModal={handleOpenEditModal}
            onDeleteHost={handleDeleteHost}
            onImportHosts={handleImportHosts}
            onQuickConnect={handleQuickConnect}
          />
        )}

        {activeTabId === 'new-tab' && (
          <NewTabView
            hosts={savedHosts}
            onSelectHost={handleSelectHost}
            onQuickConnect={handleQuickConnect}
          />
        )}

        {activeTabId === 'sftp' && <SftpView hosts={savedHosts} />}

        {/* Terminal Sessions */}
        {sessions.map((session) => (
          <TerminalTab
            key={session.id}
            session={session}
            isActive={session.id === activeTabId}
            onSessionStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* Server Modal (Add / Edit Host) */}
      <ServerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHost(null);
        }}
        onSave={handleSaveHost}
        initialHost={editingHost}
        existingGroups={Array.from(new Set(savedHosts.map((h) => h.group).filter(Boolean) as string[]))}
      />
    </div>
  );
}
