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
  CornerLeftUp,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Server,
  ArrowRight,
  Loader2,
  HardDrive,
} from 'lucide-react';

export interface SftpItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
  permissions?: string;
}

interface SftpViewProps {
  hosts: SavedHost[];
  onSelectHostToConnect?: (host: SavedHost) => void;
}

export const SftpView: React.FC<SftpViewProps> = ({ hosts }) => {
  const [selectedHostId, setSelectedHostId] = useState<string>(() => hosts[0]?.id || '');
  const [activeHost, setActiveHost] = useState<SavedHost | null>(() => hosts[0] || null);
  const [currentPath, setCurrentPath] = useState<string>('/root');
  const [pathInput, setPathInput] = useState<string>('/root');
  const [fileList, setFileList] = useState<SftpItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SftpItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to connect.');

  // Editor Modal States
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingFilePath, setEditingFilePath] = useState<string>('');
  const [editingContent, setEditingContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Sync active host when selected ID changes
  useEffect(() => {
    const found = hosts.find((h) => h.id === selectedHostId);
    if (found) {
      setActiveHost(found);
    }
  }, [selectedHostId, hosts]);

  // Connect SFTP Session over WebSocket
  const connectSftpSession = (host: SavedHost, targetPath: string = '/root') => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsLoading(true);
    setIsConnected(false);
    setStatusMessage(`Connecting SFTP session to ${host.ip}:${host.port}...`);

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
      setIsConnected(true);
      setStatusMessage(`[✔] SFTP Session Connected to ${host.ip}`);
      requestDirectoryList(targetPath);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleIncomingSftpMessage(msg);
      } catch (e) {
        // Raw message handling
      }
    };

    ws.onerror = () => {
      setIsLoading(false);
      setIsConnected(false);
      setStatusMessage(`[-] Failed to connect SFTP session on port ${host.port}`);
    };

    ws.onclose = () => {
      setIsLoading(false);
      setIsConnected(false);
    };
  };

  const requestDirectoryList = (path: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setIsLoading(true);
    setCurrentPath(path);
    setPathInput(path);
    setSelectedItem(null);
    wsRef.current.send(JSON.stringify({ type: 'sftp_list', path }));
  };

  const handleIncomingSftpMessage = (msg: any) => {
    if (msg.type === 'sftp_list_res') {
      setIsLoading(false);
      if (msg.items && Array.isArray(msg.items)) {
        setFileList(msg.items);
        setStatusMessage(`Loaded ${msg.items.length} items in ${msg.path}`);
      } else if (msg.error) {
        setStatusMessage(`[-] Error: ${msg.error}`);
      }
    } else if (msg.type === 'sftp_file_content') {
      setIsReadingFile(false);
      setEditingContent(msg.content || '');
    } else if (msg.type === 'sftp_action_res') {
      setIsSavingFile(false);
      if (msg.success) {
        setStatusMessage(`[✔] ${msg.message || 'Operation successful'}`);
        if (isEditorOpen) {
          setIsEditorOpen(false);
        }
        requestDirectoryList(currentPath);
      } else {
        alert(`[-] SFTP Error: ${msg.error || 'Operation failed'}`);
        setStatusMessage(`[-] Error: ${msg.error}`);
      }
    }
  };

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    requestDirectoryList(parentPath || '/');
  };

  const handleOpenFolder = (item: SftpItem) => {
    if (item.isDir) {
      const target = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      requestDirectoryList(target);
    } else {
      handleOpenFileEditor(item);
    }
  };

  const handleOpenFileEditor = (item: SftpItem) => {
    if (item.isDir) return;
    const fullPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
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

  const handleCreateFolder = () => {
    const folderName = prompt('Enter new folder name:');
    if (!folderName || !folderName.trim()) return;

    const newPath = currentPath === '/' ? `/${folderName.trim()}` : `${currentPath}/${folderName.trim()}`;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sftp_mkdir', path: newPath }));
    }
  };

  const handleDeleteItem = (item: SftpItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    const fullPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sftp_delete', path: fullPath, isDir: item.isDir }));
    }
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const targetPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setStatusMessage(`Uploading ${file.name}...`);
        wsRef.current.send(JSON.stringify({ type: 'sftp_write_file', path: targetPath, content }));
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadItem = (item: SftpItem) => {
    if (item.isDir) {
      alert('Downloading entire folder is not supported directly. Please download files individually.');
      return;
    }
    handleOpenFileEditor(item);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: SftpItem) => {
    if (item.isDir) return <Folder size={18} color="#0284c7" />;
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext)) {
      return <ImageIcon size={18} color="#a855f7" />;
    }
    if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) {
      return <FileArchive size={18} color="#f59e0b" />;
    }
    if (['js', 'ts', 'tsx', 'rs', 'py', 'sh', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode size={18} color="#00e676" />;
    }
    if (['txt', 'md', 'env', 'conf', 'log'].includes(ext)) {
      return <FileText size={18} color="#38bdf8" />;
    }
    return <File size={18} color="#94a3b8" />;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d111a', color: '#e6edf3', height: '100%' }}>
      {/* Top Host Connection Header */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          background: '#101624',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem' }}>
            <HardDrive size={20} color="#0284c7" />
            <span>SFTP Remote File Explorer</span>
          </div>

          {/* Host Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Target Server:</label>
            <select
              style={{
                background: '#161e30',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                outline: 'none',
              }}
              value={selectedHostId}
              onChange={(e) => setSelectedHostId(e.target.value)}
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.ip} {h.name ? `(${h.name})` : ''} - [{h.authType === 'password' ? 'SSH Pass' : 'Agent Direct'}]
                </option>
              ))}
            </select>

            <button
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              onClick={() => activeHost && connectSftpSession(activeHost, currentPath)}
            >
              <span>Connect SFTP</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: isConnected ? '#00e676' : '#94a3b8', fontWeight: 600 }}>
          {statusMessage}
        </div>
      </div>

      {/* Address & Breadcrumbs Bar */}
      <div
        style={{
          padding: '0.65rem 1.25rem',
          background: '#161e30',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <button
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            padding: '0.35rem 0.6rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={handleNavigateUp}
          title="Go Up Directory"
        >
          <CornerLeftUp size={16} />
        </button>

        <button
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            padding: '0.35rem 0.6rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={() => requestDirectoryList(currentPath)}
          title="Refresh Directory"
        >
          <RotateCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>

        {/* Path Bar Form */}
        <form
          style={{ flex: 1, display: 'flex' }}
          onSubmit={(e) => {
            e.preventDefault();
            requestDirectoryList(pathInput);
          }}
        >
          <input
            type="text"
            style={{
              flex: 1,
              background: '#0d111a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#e6edf3',
              padding: '0.4rem 0.75rem',
              fontSize: '0.85rem',
              fontFamily: "'Fira Code', monospace",
              outline: 'none',
            }}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
          />
        </form>
      </div>

      {/* Action Toolbar */}
      <div
        style={{
          padding: '0.5rem 1.25rem',
          background: '#101624',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <button
          style={{
            background: '#161e30',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e6edf3',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
          onClick={handleCreateFolder}
        >
          <FolderPlus size={15} color="#38bdf8" />
          <span>New Folder</span>
        </button>

        <label
          style={{
            background: '#161e30',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e6edf3',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Upload size={15} color="#00e676" />
          <span>Upload File</span>
          <input type="file" style={{ display: 'none' }} onChange={handleUploadFileChange} />
        </label>

        {selectedItem && (
          <>
            {!selectedItem.isDir && (
              <button
                style={{
                  background: '#161e30',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e6edf3',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                onClick={() => handleOpenFileEditor(selectedItem)}
              >
                <Edit3 size={15} color="#a855f7" />
                <span>Edit Content</span>
              </button>
            )}

            <button
              style={{
                background: '#161e30',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e6edf3',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => handleDownloadItem(selectedItem)}
            >
              <Download size={15} color="#38bdf8" />
              <span>Download</span>
            </button>

            <button
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => handleDeleteItem(selectedItem)}
            >
              <Trash2 size={15} />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>

      {/* Main File Table Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.25rem' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem', color: '#94a3b8' }}>
            <Loader2 size={36} className="animate-spin" color="#0284c7" />
            <span>Loading directory contents...</span>
          </div>
        ) : !isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: '1rem', color: '#94a3b8' }}>
            <Server size={48} color="#94a3b8" />
            <p>SFTP Session is not connected. Click "Connect SFTP" above to start.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, width: '120px' }}>Size</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, width: '160px' }}>Modified</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, width: '120px' }}>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {fileList.map((item) => {
                const isSelected = selectedItem?.name === item.name;
                return (
                  <tr
                    key={item.name}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => setSelectedItem(item)}
                    onDoubleClick={() => handleOpenFolder(item)}
                  >
                    <td style={{ padding: '0.55rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: item.isDir ? 600 : 400 }}>
                      {getFileIcon(item)}
                      <span>{item.name}</span>
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8', fontFamily: "'Fira Code', monospace" }}>
                      {item.isDir ? '--' : formatFileSize(item.size)}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8' }}>
                      {item.modified || '--'}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', color: '#94a3b8', fontFamily: "'Fira Code', monospace" }}>
                      {item.permissions || (item.isDir ? 'drwxr-xr-x' : '-rw-r--r--')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
