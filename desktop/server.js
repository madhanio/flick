import { WebSocketServer } from 'ws';
import os from 'os';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIP();
console.log(`\n==================================================`);
console.log(`⚡ Flick Local Wi-Fi P2P Relay Server Active!`);
console.log(`🔗 Local IP Address: http://${localIP}:${PORT}`);
console.log(`==================================================\n`);

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`📱 Device Connected! Active Wi-Fi Devices: ${clients.size}`);

  broadcastStatus();

  ws.on('message', (data) => {
    const messageStr = data.toString();
    const recipients = [...clients].filter((c) => c !== ws && c.readyState === 1);
    console.log(`[relay] client count: ${clients.size}, forwarding to ${recipients.length} clients`);
    for (const client of recipients) {
      client.send(messageStr);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`❌ Device disconnected. Active Wi-Fi Devices: ${clients.size}`);
    broadcastStatus();
  });
});

function broadcastStatus() {
  const statusMsg = JSON.stringify({
    type: 'DEVICE_COUNT',
    count: clients.size,
  });
  for (const client of clients) {
    if (client !== ws && client.readyState === 1) {
      client.send(statusMsg);
    }
  }
}
