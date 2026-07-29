import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SshClient } from 'ssh2';

function wsProxyPlugin(): Plugin {
  return {
    name: 'ws-proxy-plugin',
    configureServer(server) {
      if (!server.httpServer) return;

      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        if (url.pathname === '/ws-proxy') {
          const target = url.searchParams.get('target');
          const authType = url.searchParams.get('auth') || 'agent';
          const username = url.searchParams.get('user') || 'root';
          const password = url.searchParams.get('pass') || '';

          if (!target) {
            socket.destroy();
            return;
          }

          wss.handleUpgrade(request, socket, head, (clientWs) => {
            if (authType === 'password') {
              console.log(`[WS Proxy SSH] Connecting SSH Password -> ${username}@${target}`);
              
              const parts = target.split(':');
              const host = parts[0];
              const port = parseInt(parts[1]) || 22;

              const ssh = new SshClient();

              ssh.on('ready', () => {
                console.log(`[WS Proxy SSH] Authenticated successfully with ${username}@${host}:${port}`);
                clientWs.send(JSON.stringify({
                  type: 'pty_output',
                  data: '\x1b[32m[+] SSH Authentication Successful! Shell Ready.\x1b[0m\r\n'
                }));

                ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
                  if (err) {
                    clientWs.send(JSON.stringify({
                      type: 'pty_output',
                      data: `\x1b[31m[-] SSH Shell error: ${err.message}\x1b[0m\r\n`
                    }));
                    clientWs.close();
                    return;
                  }

                  stream.on('data', (data: Buffer) => {
                    if (clientWs.readyState === clientWs.OPEN) {
                      clientWs.send(JSON.stringify({
                        type: 'pty_output',
                        data: data.toString('utf-8')
                      }));
                    }
                  });

                  clientWs.on('message', (msg) => {
                    try {
                      const parsed = JSON.parse(msg.toString());
                      if (parsed.type === 'pty_input' && parsed.data) {
                        stream.write(parsed.data);
                      } else if (parsed.type === 'pty_resize' && parsed.rows && parsed.cols) {
                        stream.setWindow(parsed.rows, parsed.cols, 0, 0);
                      }
                    } catch (e) {
                      stream.write(msg.toString());
                    }
                  });

                  stream.on('close', () => {
                    clientWs.close();
                    ssh.end();
                  });
                });
              });

              ssh.on('error', (err) => {
                console.error(`[WS Proxy SSH Error] ${err.message}`);
                if (clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'pty_output',
                    data: `\x1b[31m[-] SSH Connection error: ${err.message}\x1b[0m\r\n`
                  }));
                  clientWs.close();
                }
              });

              ssh.connect({
                host,
                port,
                username,
                password,
                readyTimeout: 10000,
              });

            } else {
              // Direct Agent Proxy Mode
              const targetWsUrl = `ws://${target}/ws/terminal`;
              console.log(`[WS Proxy Agent] Proxying browser request -> ${targetWsUrl}`);

              const remoteWs = new WebSocket(targetWsUrl);

              remoteWs.on('open', () => {
                console.log(`[WS Proxy Agent] Connected to remote PTY ${targetWsUrl}`);
              });

              remoteWs.on('message', (data) => {
                if (clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(data.toString());
                }
              });

              clientWs.on('message', (data) => {
                if (remoteWs.readyState === remoteWs.OPEN) {
                  remoteWs.send(data.toString());
                }
              });

              remoteWs.on('close', () => clientWs.close());
              clientWs.on('close', () => remoteWs.close());

              remoteWs.on('error', (err) => {
                console.error(`[WS Proxy Error] ${err.message}`);
                clientWs.close();
              });
            }
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wsProxyPlugin()],
  server: {
    port: 4000,
    host: true,
  },
});
