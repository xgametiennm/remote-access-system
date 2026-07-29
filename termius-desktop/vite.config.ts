import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer, WebSocket } from 'ws';

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
          if (!target) {
            socket.destroy();
            return;
          }

          wss.handleUpgrade(request, socket, head, (clientWs) => {
            const targetWsUrl = `ws://${target}/ws/terminal`;
            console.log(`[WS Proxy] Proxying browser request -> ${targetWsUrl}`);

            const remoteWs = new WebSocket(targetWsUrl);

            remoteWs.on('open', () => {
              console.log(`[WS Proxy] Connected to remote PTY ${targetWsUrl}`);
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
