import React, { useState, useEffect, useRef } from 'react';
import { SavedHost } from '../types';
import { RemoteEditorModal } from './RemoteEditorModal';
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  File,
  RotateCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Server,
  Search,
  Monitor,
  Loader2,
  ArrowUp,
  Link as LinkIcon,
  Filter,
} from 'lucide-react';

export interface SftpItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
  permissions?: string;
  kind?: string;
}

// Sample Local File System items (matching workspace environment)
const LOCAL_SAMPLE_ITEMS: SftpItem[] = [
  { name: 'agent', path: '/agent', isDir: true, size: 0, modified: '7/29/2026, 9:45 AM', kind: 'folder' },
  { name: 'cli', path: '/cli', isDir: true, size: 0, modified: '7/29/2026, 9:39 AM', kind: 'folder' },
  { name: 'relay-server', path: '/relay-server', isDir: true, size: 0, modified: '7/29/2026, 9:39 AM', kind: 'folder' },
  { name: 'target', path: '/target', isDir: true, size: 0, modified: '7/29/2026, 9:40 AM', kind: 'folder' },
  { name: 'target_build', path: '/target_build', isDir: true, size: 0, modified: '7/29/2026, 9:42 AM', kind: 'folder' },
  { name: 'web-ui', path: '/web-ui', isDir: true, size: 0, modified: '7/29/2026, 9:41 AM', kind: 'folder' },
  { name: 'Cargo.lock', path: '/Cargo.lock', isDir: false, size: 50690, modified: '7/29/2026, 9:58 AM', kind: 'lock' },
  { name: 'Cargo.toml', path: '/Cargo.toml', isDir: false, size: 730, modified: '7/29/2026, 9:42 AM', kind: 'toml' },
  { name: 'docker-compose.yml', path: '/docker-compose.yml', isDir: false, size: 425, modified: '7/29/2026, 9:46 AM', kind: 'yml' },
  { name: 'Dockerfile.relay', path: '/Dockerfile.relay', isDir: false, size: 493, modified: '7/29/2026, 9:46 AM', kind: 'relay' },
  { name: 'Dockerfile.webui', path: '/Dockerfile.webui', isDir: false, size: 331, modified: '7/29/2026, 9:46 AM', kind: 'webui' },
  { name: 'nginx.conf', path: '/nginx.conf', isDir: false, size: 805, modified: '7/29/2026, 9:46 AM', kind: 'conf' },
  { name: 'README.md', path: '/README.md', isDir: false, size: 2048, modified: '7/29/2026, 9:51 AM', kind: 'md' },
];

interface SftpViewProps {
  hosts: SavedHost[];
}

export const SftpView: React.FC<SftpViewProps> = ({ hosts }) => {
  // Remote Pane States
  const [selectedHostId, setSelectedHostId] = useState<string>(() => hosts[0]?.id || '');
  const [activeHost, setActiveHost] = useState<SavedHost | null>(() => hosts[0] || null);
  const [remotePath, setRemotePath] = useState<string>('/usr/local');
  const [remoteFileList, setRemoteFileList] = useState<SftpItem[]>([]);
  const [selectedRemoteItem, setSelectedRemoteItem] = useState<SftpItem | null>(null);
  const [isRemoteLoading, setIsRemoteLoading] = useState<boolean>(false);
  const [isRemoteConnected, setIsRemoteConnected] = useState<boolean>(false);
  const [remoteFilter, setRemoteFilter] = useState<string>('');

  // Local Pane States
  const [localPath, setLocalPath] = useState<string>('D: > Research > Supper web > remote-access-system');
  const [localFileList, setLocalFileList] = useState<SftpItem[]>(LOCAL_SAMPLE_ITEMS);
  const [selectedLocalItem, setSelectedLocalItem] = useState<SftpItem | null>(LOCAL_SAMPLE_ITEMS[0]);
  const [localFilter, setLocalFilter] = useState<string>('');

  // Editor Modal States
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingFilePath, setEditingFilePath] = useState<string>('');
  const [editingContent, setEditingContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const found = hosts.find((h) => h.id === selectedHostId);
    if (found) {
      setActiveHost(found);
    }
  }, [selectedHostId, hosts]);

  // Connect SFTP Session over WebSocket
  const connectSftpSession = (host: SavedHost, targetPath: string = '/usr/local') => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsRemoteLoading(true);
    setIsRemoteConnected(false);

    const isTauriNative =
      window.location.protocol === 'tauri:' ||
      window.location.protocol === 'asset:' ||
      window.location.protocol === 'file:' ||
      window.location.hostname === 'tauri.localhost' ||
      window.location.hostname === 'localhost';

    const authType = host.authType || 'agent';
    const authParam = `&auth=${authType}`;
    const userParam = host.username ? `&user=${encodeURIComponent(host.username)}` : '';
    const passParam = host.password ? `&pass=${encodeURIComponent(host.password)}` : '';

    const query = `mode=sftp&target=${host.ip}:${host.port}${authParam}${userParam}${passParam}`;

    const wsUrl = isTauriNative
      ? `ws://127.0.0.1:18888/ws-proxy?${query}`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-proxy?${query}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsRemoteConnected(true);
      requestRemoteDirectoryList(targetPath);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleIncomingSftpMessage(msg);
      } catch (e) {
        // Raw handling
      }
    };

    ws.onerror = () => {
      setIsRemoteLoading(false);
      setIsRemoteConnected(false);
    };

    ws.onclose = () => {
      setIsRemoteLoading(false);
      setIsRemoteConnected(false);
    };
  };

  const requestRemoteDirectoryList = (path: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setIsRemoteLoading(true);
    setRemotePath(path);
    setSelectedRemoteItem(null);
    wsRef.current.send(JSON.stringify({ type: 'sftp_list', path }));
  };

  const handleIncomingSftpMessage = (msg: any) => {
    if (msg.type === 'sftp_list_res') {
      setIsRemoteLoading(false);
      if (msg.items && Array.isArray(msg.items)) {
        const formatted = msg.items.map((item: any) => {
          const ext = item.name.split('.').pop()?.toLowerCase() || '';
          return {
            ...item,
            kind: item.isDir ? 'folder' : ext,
          };
        });
        setRemoteFileList(formatted);
      }
    } else if (msg.type === 'sftp_file_content') {
      setIsReadingFile(false);
      setEditingContent(msg.content || '');
    } else if (msg.type === 'sftp_action_res') {
      setIsSavingFile(false);
      if (msg.success) {
        if (isEditorOpen) {
          setIsEditorOpen(false);
        }
        requestRemoteDirectoryList(remotePath);
      } else {
        alert(`[-] SFTP Error: ${msg.error || 'Operation failed'}`);
      }
    }
  };

  const handleRemoteNavigateUp = () => {
    if (remotePath === '/' || remotePath === '') return;
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    requestRemoteDirectoryList(parentPath || '/');
  };

  const handleRemoteOpenFolder = (item: SftpItem) => {
    if (item.name === '..') {
      handleRemoteNavigateUp();
      return;
    }
    if (item.isDir) {
      const target = remotePath === '/' ? `/${item.name}` : `${remotePath}/${item.name}`;
      requestRemoteDirectoryList(target);
    } else {
      handleOpenFileEditor(item);
    }
  };

  const handleOpenFileEditor = (item: SftpItem) => {
    if (item.isDir) return;
    const fullPath = remotePath === '/' ? `/${item.name}` : `${remotePath}/${item.name}`;
    setEditingFilePath(fullPath);
    setEditingContent('');
    setIsEditorOpen(true);
    setIsReadingFile(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sftp_read_file', path: fullPath }));
    }
  };

  const handleSaveRemoteFile = (path: string, newContent: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setIsSavingFile(true);
    wsRef.current.send(JSON.stringify({ type: 'sftp_write_file', path, content: newContent }));
  };

  const handleCreateRemoteFolder = () => {
    const folderName = prompt('Enter new folder name:');
    if (!folderName || !folderName.trim()) return;

    const newPath = remotePath === '/' ? `/${folderName.trim()}` : `${remotePath}/${folderName.trim()}`;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sftp_mkdir', path: newPath }));
    }
  };

  const handleDeleteRemoteItem = (item: SftpItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    const fullPath = remotePath === '/' ? `/${item.name}` : `${remotePath}/${item.name}`;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sftp_delete', path: fullPath, isDir: item.isDir }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: SftpItem) => {
    if (item.name === '..') return <Folder size={16} color="#38bdf8" />;
    if (item.isDir) return <Folder size={16} color="#38bdf8" />;
    const ext = item.kind || item.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) {
      return <ImageIcon size={16} color="#a855f7" />;
    }
    if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) {
      return <FileArchive size={16} color="#f59e0b" />;
    }
    if (['js', 'ts', 'tsx', 'rs', 'py', 'sh', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode size={16} color="#00e676" />;
    }
    if (['txt', 'md', 'env', 'conf', 'log', 'lock', 'yml', 'yaml'].includes(ext)) {
      return <FileText size={16} color="#94a3b8" />;
    }
    if (ext === 'link') {
      return <LinkIcon size={16} color="#38bdf8" />;
    }
    return <File size={16} color="#94a3b8" />;
  };

  // Render Breadcrumb Parts
  const renderBreadcrumbs = (pathString: string, isRemote: boolean = false) => {
    if (isRemote) {
      const parts = pathString.split('/').filter(Boolean);
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
          <button
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}
            onClick={handleRemoteNavigateUp}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}
            onClick={() => requestRemoteDirectoryList(remotePath)}
          >
            <ChevronRight size={16} />
          </button>

          {parts.map((p, idx) => {
            const partialPath = '/' + parts.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={partialPath}>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>/</span>
                <span
                  style={{
                    color: idx === parts.length - 1 ? '#e6edf3' : '#94a3b8',
                    fontWeight: idx === parts.length - 1 ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                  onClick={() => requestRemoteDirectoryList(partialPath)}
                >
                  {p}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    // Local Breadcrumb
    const localParts = ['D:', 'Research', 'Supper web', 'remote-access-system'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
        <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}>
          <ChevronLeft size={16} />
        </button>
        <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}>
          <ChevronRight size={16} />
        </button>
        <Folder size={15} color="#38bdf8" />
        {localParts.map((p, idx) => (
          <React.Fragment key={p}>
            {idx > 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>&gt;</span>}
            <span style={{ color: idx === localParts.length - 1 ? '#e6edf3' : '#94a3b8', fontSize: '0.82rem' }}>
              {p}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const filteredLocalList = localFileList.filter((i) => i.name.toLowerCase().includes(localFilter.toLowerCase()));
  const filteredRemoteList = remoteFileList.filter((i) => i.name.toLowerCase().includes(remoteFilter.toLowerCase()));

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', background: '#0d111a', color: '#e6edf3', overflow: 'hidden' }}>
      {/* ---------------------------------------------------- */}
      {/* LEFT PANE: LOCAL COMPUTER                            */}
      {/* ---------------------------------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {/* Top Header Bar */}
        <div
          style={{
            padding: '0.6rem 1rem',
            background: '#101624',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
            <Monitor size={17} color="#38bdf8" />
            <span>Local</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Search size={14} />
              <span>Filter</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              <span>Actions</span>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation Bar */}
        <div
          style={{
            padding: '0.45rem 1rem',
            background: '#161e30',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {renderBreadcrumbs(localPath, false)}
        </div>

        {/* Local File Table */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#0d111a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textAlign: 'left', background: '#101624' }}>
                <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600 }}>
                  Name <ArrowUp size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                </th>
                <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '160px' }}>Date Modified</th>
                <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '90px' }}>Size</th>
                <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '80px' }}>Kind</th>
              </tr>
            </thead>
            <tbody>
              {/* Parent Dir Row */}
              <tr
                style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', cursor: 'pointer' }}
                onClick={() => setSelectedLocalItem(null)}
              >
                <td style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Folder size={16} color="#38bdf8" />
                  <span>..</span>
                </td>
                <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
                <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
                <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
              </tr>

              {filteredLocalList.map((item) => {
                const isSelected = selectedLocalItem?.name === item.name;
                return (
                  <tr
                    key={item.name}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isSelected ? '#0284c7' : 'transparent',
                      color: isSelected ? '#ffffff' : '#e6edf3',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedLocalItem(item)}
                  >
                    <td style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: item.isDir ? 500 : 400 }}>
                      {getFileIcon(item)}
                      <span>{item.name}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{item.modified}</td>
                    <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{formatFileSize(item.size)}</td>
                    <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{item.kind}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* RIGHT PANE: REMOTE SERVER (SFTP)                     */}
      {/* ---------------------------------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar with Host Selector */}
        <div
          style={{
            padding: '0.6rem 1rem',
            background: '#101624',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                background: '#f97316',
                color: '#fff',
                borderRadius: '6px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Server size={13} />
              {activeHost ? activeHost.ip : 'Select Server'}
            </span>

            <select
              style={{
                background: '#161e30',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                outline: 'none',
              }}
              value={selectedHostId}
              onChange={(e) => {
                setSelectedHostId(e.target.value);
                const host = hosts.find((h) => h.id === e.target.value);
                if (host) connectSftpSession(host, '/usr/local');
              }}
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.ip} {h.name ? `- ${h.name}` : ''}
                </option>
              ))}
            </select>

            {!isRemoteConnected && activeHost && (
              <button
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => connectSftpSession(activeHost, '/usr/local')}
              >
                Connect SFTP
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              <Search size={14} />
              <span>Filter</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
              <span>Actions</span>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation Bar */}
        <div
          style={{
            padding: '0.45rem 1rem',
            background: '#161e30',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {renderBreadcrumbs(remotePath, true)}
        </div>

        {/* Remote File Table */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#0d111a' }}>
          {isRemoteLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem', color: '#94a3b8' }}>
              <Loader2 size={32} className="animate-spin" color="#0284c7" />
              <span>Fetching remote directory...</span>
            </div>
          ) : !isRemoteConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
              <Server size={44} color="#94a3b8" />
              <p style={{ fontSize: '0.85rem' }}>SFTP session is not connected.</p>
              <button
                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => activeHost && connectSftpSession(activeHost, '/usr/local')}
              >
                Connect to {activeHost?.ip || 'Server'}
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textAlign: 'left', background: '#101624' }}>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600 }}>
                    Name <ArrowUp size={11} style={{ display: 'inline', marginLeft: '3px' }} />
                  </th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '160px' }}>Date Modified</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '90px' }}>Size</th>
                  <th style={{ padding: '0.5rem 0.85rem', fontWeight: 600, width: '80px' }}>Kind</th>
                </tr>
              </thead>
              <tbody>
                {/* Parent Dir Row */}
                <tr
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', cursor: 'pointer' }}
                  onClick={() => handleRemoteOpenFolder({ name: '..', path: '', isDir: true, size: 0, modified: '' })}
                >
                  <td style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Folder size={16} color="#38bdf8" />
                    <span>..</span>
                  </td>
                  <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
                  <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
                  <td style={{ padding: '0.45rem 0.85rem', color: '#94a3b8' }}>--</td>
                </tr>

                {filteredRemoteList.map((item) => {
                  const isSelected = selectedRemoteItem?.name === item.name;
                  return (
                    <tr
                      key={item.name}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isSelected ? '#0284c7' : 'transparent',
                        color: isSelected ? '#ffffff' : '#e6edf3',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedRemoteItem(item)}
                      onDoubleClick={() => handleRemoteOpenFolder(item)}
                    >
                      <td style={{ padding: '0.45rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontWeight: item.isDir ? 500 : 400 }}>
                          {getFileIcon(item)}
                          <span>{item.name}</span>
                        </div>
                        {item.permissions && (
                          <div style={{ fontSize: '0.7rem', color: isSelected ? '#e0f2fe' : '#64748b', fontFamily: "'Fira Code', monospace", marginLeft: '1.55rem' }}>
                            {item.permissions}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{item.modified || '--'}</td>
                      <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{formatFileSize(item.size)}</td>
                      <td style={{ padding: '0.45rem 0.85rem', color: isSelected ? '#f8fafc' : '#94a3b8' }}>{item.kind || (item.isDir ? 'folder' : 'file')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Remote File Text Editor Modal */}
      <RemoteEditorModal
        isOpen={isEditorOpen}
        filePath={editingFilePath}
        initialContent={editingContent}
        isLoading={isReadingFile}
        isSaving={isSavingFile}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveRemoteFile}
      />
    </div>
  );
};
