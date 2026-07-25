import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer } from 'ws';

function flickRelayPlugin(): Plugin {
  return {
    name: 'flick-relay-plugin',
    configureServer() {
      try {
        const wss = new WebSocketServer({ port: 8080 });
        const clients = new Set<any>();

        wss.on('connection', (ws) => {
          clients.add(ws);
          
          const broadcastStatus = () => {
            // Subtract 1 for laptop's own connection so badge shows actual secondary paired devices
            const remoteDeviceCount = Math.max(0, clients.size - 1);
            const msg = JSON.stringify({ type: 'DEVICE_COUNT', count: remoteDeviceCount });
            for (const c of clients) {
              if (c.readyState === 1) c.send(msg);
            }
          };
          broadcastStatus();

          ws.on('message', (data) => {
            const str = data.toString();
            for (const c of clients) {
              if (c !== ws && c.readyState === 1) c.send(str);
            }
          });

          ws.on('close', () => {
            clients.delete(ws);
            broadcastStatus();
          });
        });
        console.log('⚡ Flick Local Wi-Fi WebSocket Relay Active on port 8080');
      } catch (err) {
        console.warn('Relay server active');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), flickRelayPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  }
});
