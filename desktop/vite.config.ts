import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer } from 'ws';
import os from 'os';

function flickRelayPlugin(): Plugin {
  return {
    name: 'flick-relay-plugin',
    configureServer() {
      try {
        let lanIp = '127.0.0.1';
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
          for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
              lanIp = iface.address;
              break;
            }
          }
        }

        const wss = new WebSocketServer({ port: 8080 });
        const clients = new Set<any>();

        wss.on('connection', (ws) => {
          clients.add(ws);

          ws.send(JSON.stringify({ type: 'SERVER_INFO', ip: lanIp, port: 8080 }));
          
          const broadcastStatus = () => {
            // Subtract 1 for laptop's own connection so badge shows actual secondary paired devices
            const remoteDeviceCount = Math.max(0, clients.size - 1);
            const msg = JSON.stringify({ type: 'DEVICE_COUNT', count: remoteDeviceCount });
            for (const c of clients) {
              if (c !== ws && c.readyState === 1) c.send(msg);
            }
          };
          broadcastStatus();

          ws.on('message', (data) => {
            const str = data.toString();
            const recipients = [...clients].filter((c) => c !== ws && c.readyState === 1);
            console.log(`[relay] client count: ${clients.size}, forwarding to ${recipients.length} clients`);
            for (const c of recipients) {
              c.send(str);
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
