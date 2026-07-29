import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { TabSession } from '../types';

interface TerminalTabProps {
  session: TabSession;
  isActive: boolean;
  onSessionStatusChange: (id: string, status: 'connected' | 'disconnected') => void;
}

const COMMON_SUGGESTIONS = [
  'docker restart',
  'docker ps',
  'docker ps -a',
  'docker logs -f',
  'docker logs --tail 100',
  'docker exec -it',
  'docker stop',
  'docker start',
  'docker rm',
  'docker rmi',
  'docker images',
  'docker run -d',
  'docker build -t',
  'docker-compose up -d',
  'docker-compose down',
  'docker-compose restart',
  'systemctl status',
  'systemctl restart',
  'cargo build --release',
  'cargo run',
  'ls -la',
  'htop',
  'df -h',
  'free -m',
];

export const TerminalTab: React.FC<TerminalTabProps> = ({
  session,
  isActive,
  onSessionStatusChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Inline Auto-Suggestion State Refs
  const lineBufferRef = useRef('');
  const activeSuggestionRef = useRef('');
  const ghostLengthRef = useRef(0);
  const historyRef = useRef<string[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Real-time Server Entities (Harvested from remote PTY stream & pre-seeded)
  const serverEntitiesRef = useRef<{ files: string[]; containers: string[] }>({
    files: [
      '.cache',
      '.cargo',
      '.config',
      '.docker',
      '.local',
      '.npm',
      '.rustup',
      '.ssh',
      '.vcpkg',
      '.bashrc',
      '.profile',
      '.bash_history',
      '.viminfo',
      '.gitconfig',
    ],
    containers: ['remote-agent', 'game-server', 'color-blast', 'mysql', 'redis', 'nginx'],
  });

  useEffect(() => {
    if (!containerRef.current) return;

    let isDisposed = false;

    // Initialize xterm.js with GPU WebGL acceleration & ultra-fast response options
    const term = new Terminal({
      cursorBlink: true,
      scrollback: 10000,
      fastScrollSensitivity: 5,
      allowProposedApi: true,
      theme: {
        background: '#0c1017',
        foreground: '#00e676',   // Vibrant emerald green prompt & text
        cursor: '#00e676',
        cursorAccent: '#0c1017',
        selectionBackground: 'rgba(0, 230, 118, 0.3)',
        black: '#1e293b',
        red: '#ff5555',
        green: '#00e676',
        yellow: '#f59e0b',
        blue: '#38bdf8',         // Vivid sky blue for directories (.cache, .docker, .ssh)
        magenta: '#c084fc',
        cyan: '#22d3ee',        // Bright cyan for header info
        white: '#00e676',        // Vibrant emerald green text
        brightBlack: '#64748b',  // Muted gray for ghost text inline suggestions
        brightRed: '#ef4444',
        brightGreen: '#00e676',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',   // Bright blue for bold folder names
        brightMagenta: '#e879f9',
        brightCyan: '#38bdf8',
        brightWhite: '#ffffff',
      },
      fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    // Enable GPU WebGL Renderer for 60-120fps ultra-smooth zero-latency rendering
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        try { webglAddon.dispose(); } catch (e) {}
      });
      term.loadAddon(webglAddon);
    } catch (e) {
      try {
        const canvasAddon = new CanvasAddon();
        term.loadAddon(canvasAddon);
      } catch (e2) {
        // Fallback to standard renderer
      }
    }

    try {
      term.writeln(`\x1b[36m[*] Termius Client: Connecting directly to Remote PTY: ${session.ip}:${session.port}...\x1b[0m\r\n`);
    } catch (e) {}

    // Connect WebSocket via Native Proxy
    const isTauriNative =
      window.location.protocol === 'tauri:' ||
      window.location.protocol === 'asset:' ||
      window.location.protocol === 'file:' ||
      window.location.hostname === 'tauri.localhost' ||
      window.location.hostname === 'localhost';

    const wsUrl = isTauriNative
      ? `ws://127.0.0.1:18888/ws-proxy?target=${session.ip}:${session.port}`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-proxy?target=${session.ip}:${session.port}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isDisposed) return;
      try {
        term.writeln('\x1b[32m[+] Direct PTY Stream Established! Shell Ready.\x1b[0m\r\n');
      } catch (e) {}
      onSessionStatusChange(session.id, 'connected');

      // Send initial size
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: 'pty_resize',
              rows: term.rows,
              cols: term.cols,
            })
          );
        } catch (e) {}
      }
    };

    const clearGhostText = () => {
      if (isDisposed) return;
      if (ghostLengthRef.current > 0) {
        try {
          term.write(' '.repeat(ghostLengthRef.current) + `\x1b[${ghostLengthRef.current}D`);
        } catch (e) {}
        ghostLengthRef.current = 0;
        activeSuggestionRef.current = '';
      }
    };

    // Harvest real server entities from PTY output text
    const parsePtyOutputForEntities = (rawText: string) => {
      if (isDisposed) return;
      const clean = rawText.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

      // Parse directory / file listings
      const lsRegex = /(?:[drwx-]{10})\s+\d+\s+\w+\s+\w+\s+\d+\s+[A-Za-z]{3}\s+\d+\s+[\d:]+\s+([^\s]+)/g;
      let m;
      while ((m = lsRegex.exec(clean)) !== null) {
        const name = m[1];
        if (name && name !== '.' && name !== '..' && !serverEntitiesRef.current.files.includes(name)) {
          serverEntitiesRef.current.files.push(name);
        }
      }

      // Parse docker container names
      const dockerRegex = /([a-zA-Z0-9_-]{3,35})\s+(?:Up|Exited|Created)/g;
      while ((m = dockerRegex.exec(clean)) !== null) {
        const cName = m[1];
        if (cName && !serverEntitiesRef.current.containers.includes(cName)) {
          serverEntitiesRef.current.containers.push(cName);
        }
      }
    };

    ws.onmessage = (event) => {
      if (isDisposed) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pty_output' && msg.data) {
          term.write(msg.data);
          parsePtyOutputForEntities(msg.data);
        }
      } catch (err) {
        try {
          term.write(event.data);
        } catch (e) {}
        parsePtyOutputForEntities(event.data);
      }
    };

    ws.onclose = () => {
      if (isDisposed) return;
      try {
        term.writeln('\r\n\x1b[31m[-] PTY Session closed by remote host.\x1b[0m');
      } catch (e) {}
      onSessionStatusChange(session.id, 'disconnected');
    };

    ws.onerror = () => {
      if (isDisposed) return;
      try {
        term.writeln('\r\n\x1b[31m[-] Connection error. Ensure remote_agent is running on port ' + session.port + '.\x1b[0m');
      } catch (e) {}
      onSessionStatusChange(session.id, 'disconnected');
    };

    term.onData((data) => {
      if (isDisposed || ws.readyState !== WebSocket.OPEN) return;

      // Handle Enter Key
      if (data === '\r') {
        clearGhostText();
        const cmd = lineBufferRef.current.trim();
        if (cmd && !historyRef.current.includes(cmd)) {
          historyRef.current.unshift(cmd);
        }
        lineBufferRef.current = '';
        try {
          ws.send(JSON.stringify({ type: 'pty_input', data }));
        } catch (e) {}
        return;
      }

      // Handle Backspace / Delete
      if (data === '\x7f' || data === '\b') {
        clearGhostText();
        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        try {
          ws.send(JSON.stringify({ type: 'pty_input', data }));
        } catch (e) {}
        scheduleInlineSuggestion();
        return;
      }

      // Handle Tab Key OR Right Arrow (\x1b[C) to accept inline suggestion
      if ((data === '\t' || data === '\x1b[C') && activeSuggestionRef.current) {
        const suffix = activeSuggestionRef.current;
        clearGhostText();
        lineBufferRef.current += suffix;
        try {
          ws.send(JSON.stringify({ type: 'pty_input', data: suffix }));
        } catch (e) {}
        return;
      }

      // Standard character input (Fast-path rendering)
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        clearGhostText();
        lineBufferRef.current += data;
        try {
          ws.send(JSON.stringify({ type: 'pty_input', data }));
        } catch (e) {}
        scheduleInlineSuggestion();
        return;
      }

      // Other control keys
      clearGhostText();
      if (data === '\x03') {
        lineBufferRef.current = '';
      }
      try {
        ws.send(JSON.stringify({ type: 'pty_input', data }));
      } catch (e) {}
    });

    // Schedule suggestion calculation asynchronously via requestAnimationFrame for zero UI stutter
    const scheduleInlineSuggestion = () => {
      if (isDisposed) return;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(updateInlineSuggestion);
    };

    const updateInlineSuggestion = () => {
      if (isDisposed) return;
      const current = lineBufferRef.current;
      if (!current || current.trim().length < 2) return;

      // 1. Docker command arguments with REAL server containers
      if (
        current.startsWith('docker logs ') ||
        current.startsWith('docker restart ') ||
        current.startsWith('docker stop ') ||
        current.startsWith('docker start ') ||
        current.startsWith('docker exec -it ')
      ) {
        const lastSpaceIdx = current.lastIndexOf(' ');
        const prefix = current.slice(0, lastSpaceIdx + 1);
        const argTyped = current.slice(lastSpaceIdx + 1);

        for (const container of serverEntitiesRef.current.containers) {
          if (container.startsWith(argTyped) && container !== argTyped) {
            const fullSuggestion = prefix + container;
            const suffix = fullSuggestion.slice(current.length);
            activeSuggestionRef.current = suffix;
            ghostLengthRef.current = suffix.length;
            try {
              term.write(`\x1b[90m\x1b[3m${suffix}\x1b[0m\x1b[${suffix.length}D`);
            } catch (e) {}
            return;
          }
        }
      }

      // 2. File & Directory paths with REAL server files
      if (
        current.startsWith('cd ') ||
        current.startsWith('cat ') ||
        current.startsWith('vim ') ||
        current.startsWith('nano ') ||
        current.startsWith('ls ')
      ) {
        const lastSpaceIdx = current.lastIndexOf(' ');
        const prefix = current.slice(0, lastSpaceIdx + 1);
        const argTyped = current.slice(lastSpaceIdx + 1);

        for (const file of serverEntitiesRef.current.files) {
          if (file.startsWith(argTyped) && file !== argTyped) {
            const fullSuggestion = prefix + file;
            const suffix = fullSuggestion.slice(current.length);
            activeSuggestionRef.current = suffix;
            ghostLengthRef.current = suffix.length;
            try {
              term.write(`\x1b[90m\x1b[3m${suffix}\x1b[0m\x1b[${suffix.length}D`);
            } catch (e) {}
            return;
          }
        }
      }

      // 3. Fallback to Command History and Common Commands Dictionary
      const pool = [...historyRef.current, ...COMMON_SUGGESTIONS];
      const match = pool.find((s) => s.startsWith(current) && s !== current);

      if (match) {
        const suffix = match.slice(current.length);
        activeSuggestionRef.current = suffix;
        ghostLengthRef.current = suffix.length;

        // Print ghost text in muted gray italic font (\x1b[90m\x1b[3m) then move cursor back
        try {
          term.write(`\x1b[90m\x1b[3m${suffix}\x1b[0m\x1b[${suffix.length}D`);
        } catch (e) {}
      }
    };

    const handleResize = () => {
      if (isDisposed) return;
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'pty_resize',
              rows: term.rows,
              cols: term.cols,
            })
          );
        }
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);

      // Remove WebSocket event listeners to prevent onclose/onerror callbacks on unmount
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch (e) {}
      }

      wsRef.current = null;
      xtermRef.current = null;

      try {
        term.dispose();
      } catch (e) {}
    };
  }, [session.id, session.ip, session.port]);

  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%',
        paddingLeft: '5px',
        paddingBottom: '10px',
        boxSizing: 'border-box',
        background: '#0c1017',
        overflow: 'hidden',
      }}
    />
  );
};
