import Peer, { DataConnection } from 'peerjs';
import { FlickMessage, PairedDevice, PairingTicket } from './types';

type MessageCallback = (msg: FlickMessage) => void;
type ConnectionCallback = (device: PairedDevice) => void;
type ServerInfoCallback = (ip: string, port: number) => void;

export class FlickP2PService {
  private peer: Peer | null = null;
  private ws: WebSocket | null = null;
  public myPeerId: string = '';
  public deviceId: string = '';
  public deviceName: string = '';
  public relayIp: string = '';
  public relayPort: number = 8080;
  private connections: Map<string, DataConnection> = new Map();
  private pairedDevicesMap: Map<string, PairedDevice> = new Map();
  private onMessageCallbacks: MessageCallback[] = [];
  private onConnectCallbacks: ConnectionCallback[] = [];
  private onServerInfoCallbacks: ServerInfoCallback[] = [];

  constructor(deviceName?: string) {
    this.deviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    this.deviceName = deviceName || (this.isMobile() ? 'Mobile Phone' : 'Laptop Browser');
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  public async initialize(): Promise<string> {
    const cleanId = 'flick_' + Math.random().toString(36).substring(2, 10);
    this.myPeerId = cleanId;

    // Connect to Local Wi-Fi WebSocket Relay
    this.connectLocalWebSocket();

    // Also initialize PeerJS for P2P backup
    return new Promise((resolve) => {
      try {
        this.peer = new Peer(cleanId, { debug: 1 });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          console.log('⚡ Flick Local & PeerJS P2P Ready! My Peer ID:', id);
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          console.log('⚡ Incoming P2P connection from:', conn.peer);
          this.handleConnection(conn);
        });

        this.peer.on('error', () => {
          resolve(cleanId);
        });
      } catch (_) {
        resolve(cleanId);
      }
    });
  }

  public connectLocalWebSocket(customHost?: string) {
    try {
      const host = customHost || window.location.hostname || 'localhost';
      const wsUrl = `ws://${host}:8080`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('⚡ Connected to Local Wi-Fi Relay Server!');
        this.ws?.send(JSON.stringify({
          type: 'HANDSHAKE',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          peerId: this.myPeerId,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SERVER_INFO') {
            this.relayIp = data.ip || '';
            this.relayPort = data.port || 8080;
            this.onServerInfoCallbacks.forEach((cb) => cb(this.relayIp, this.relayPort));
          } else if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_ACK') {
            const incomingDeviceId = data.deviceId;
            const incomingPeerId = data.peerId;

            // Rule 2: Filter self from pairedDevicesMap (including Laptop Browser self-echo)
            if (!incomingDeviceId || incomingDeviceId === this.deviceId || incomingPeerId === this.myPeerId || data.deviceName === 'Laptop Browser') return;

            // Rule 1: Disable PeerJS ONLY after the FIRST valid remote handshake is received over WebSocket
            if (this.peer) {
              console.log('⚡ Active remote peer on WebSocket relay. Disabling PeerJS.');
              this.peer.destroy();
              this.peer = null;
              this.connections.forEach((conn) => conn.close());
              this.connections.clear();
            }

            const pairedDev: PairedDevice = {
              deviceId: incomingDeviceId,
              deviceName: data.deviceName || 'Android Mobile',
              peerId: incomingPeerId || 'mobile_peer',
              pairedAt: Date.now(),
            };

            // Rule 3: Single canonical entry per device (key by deviceId)
            const existing = this.pairedDevicesMap.get(incomingDeviceId);
            if (existing) {
              existing.deviceName = pairedDev.deviceName;
              existing.peerId = pairedDev.peerId;
              existing.pairedAt = pairedDev.pairedAt;
            } else {
              this.pairedDevicesMap.set(incomingDeviceId, pairedDev);
            }

            if (data.type === 'HANDSHAKE') {
              this.ws?.send(JSON.stringify({
                type: 'HANDSHAKE_ACK',
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                peerId: this.myPeerId,
              }));
            }

            this.onConnectCallbacks.forEach((cb) => cb(pairedDev));
          } else if (data.type === 'FLICK') {
            if (data.senderId === this.deviceId) return;
            const msg: FlickMessage = data.payload;
            if (msg && msg.fromDeviceId !== this.deviceId) {
              msg.status = 'received';
              this.onMessageCallbacks.forEach((cb) => cb(msg));
            }
          }
        } catch (_) {}
      };

      // Rule 4: Clean up on WebSocket disconnect
      this.ws.onclose = () => {
        console.log('⚡ WebSocket Relay disconnected');
        this.pairedDevicesMap.clear();
        this.onConnectCallbacks.forEach((cb) => cb({ deviceId: '', deviceName: '', peerId: '', pairedAt: 0 }));
      };

      this.ws.onerror = () => {
        console.log('⚡ WebSocket Relay error');
      };
    } catch (_) {}
  }

  private handleConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    const onData = (raw: any) => {
      if (!raw) return;
      let data = raw;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch (_) {
          data = raw;
        }
      }

      if (data && (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_ACK')) {
        const incomingDeviceId = data.deviceId;
        const incomingPeerId = data.peerId || conn.peer;

        // Rule 2: Filter self from pairedDevicesMap
        if (!incomingDeviceId || incomingDeviceId === this.deviceId || incomingPeerId === this.myPeerId || data.deviceName === 'Laptop Browser') return;

        const pairedDev: PairedDevice = {
          deviceId: incomingDeviceId,
          deviceName: data.deviceName || 'Android Mobile',
          peerId: incomingPeerId,
          pairedAt: Date.now(),
        };

        // Rule 3: Single canonical entry per device (key by deviceId)
        const existing = this.pairedDevicesMap.get(incomingDeviceId);
        if (existing) {
          existing.deviceName = pairedDev.deviceName;
          existing.peerId = pairedDev.peerId;
          existing.pairedAt = pairedDev.pairedAt;
        } else {
          this.pairedDevicesMap.set(incomingDeviceId, pairedDev);
        }

        if (data.type === 'HANDSHAKE') {
          conn.send({
            type: 'HANDSHAKE_ACK',
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            peerId: this.myPeerId,
          });
        }

        this.onConnectCallbacks.forEach((cb) => cb(pairedDev));
      } else if (data && data.type === 'FLICK') {
        const msg: FlickMessage = data.payload;
        if (!msg) return;
        if (msg.fromDeviceId === this.deviceId) return;
        msg.status = 'received';
        this.onMessageCallbacks.forEach((cb) => cb(msg));
      }
    };

    conn.off('data');
    conn.on('data', onData);

    const sendHandshake = () => {
      conn.send({
        type: 'HANDSHAKE',
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        peerId: this.myPeerId,
      });
    };

    if (conn.open) {
      sendHandshake();
    } else {
      conn.on('open', () => {
        sendHandshake();
      });
    }

    // Rule 4: Clean up on WebRTC connection close
    conn.on('close', () => {
      this.connections.delete(conn.peer);
      for (const [devId, dev] of this.pairedDevicesMap.entries()) {
        if (dev.peerId === conn.peer) {
          this.pairedDevicesMap.delete(devId);
          break;
        }
      }
      this.onConnectCallbacks.forEach((cb) => cb({ deviceId: '', deviceName: '', peerId: '', pairedAt: 0 }));
    });
  }

  public connectToPeer(targetPeerId: string): Promise<PairedDevice> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('P2P engine not initialized');

      const cleanTargetId = targetPeerId.trim();
      const conn = this.peer.connect(cleanTargetId);

      conn.on('open', () => {
        this.handleConnection(conn);
        const dev: PairedDevice = {
          deviceId: 'dev_' + cleanTargetId.substring(0, 6),
          deviceName: 'Android Mobile',
          peerId: cleanTargetId,
          pairedAt: Date.now(),
        };
        // Rule 3: Single canonical entry per device
        this.pairedDevicesMap.set(dev.deviceId, dev);
        resolve(dev);
      });

      conn.on('error', (err) => reject(err));
    });
  }

  public broadcastFlick(content: string): FlickMessage {
    const sensitive = this.detectSensitive(content);
    const preview = sensitive
      ? '🔒 Sensitive content — tap to reveal'
      : content.length > 60
      ? content.substring(0, 60) + '...'
      : content;

    const message: FlickMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      content,
      preview,
      sensitive,
      fromDeviceId: this.deviceId,
      fromDeviceName: this.deviceName,
      timestamp: Date.now(),
      status: 'sent',
    };

    // Rule 5: broadcastFlick transport priority
    // Send ONLY via WebSocket Relay if connected, else fall back to WebRTC
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'FLICK',
        senderId: this.deviceId,
        payload: message,
      }));
    } else {
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send({
            type: 'FLICK',
            payload: message,
          });
        }
      });
    }

    return message;
  }

  public connectToRelayIp(ip: string): Promise<PairedDevice> {
    return new Promise((resolve) => {
      this.connectLocalWebSocket(ip);
      const dev: PairedDevice = {
        deviceId: 'dev_' + ip.replaceAll('.', '_'),
        deviceName: 'Android Mobile (Local Wi-Fi)',
        peerId: 'mobile_wifi',
        pairedAt: Date.now(),
      };
      resolve(dev);
    });
  }

  public createPairingTicket(): PairingTicket {
    return {
      version: 1,
      ip: this.relayIp || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
      port: this.relayPort || 8080,
      peerId: this.myPeerId,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
    };
  }

  public getPairedDevices(): PairedDevice[] {
    return Array.from(this.pairedDevicesMap.values());
  }

  public onMessage(cb: MessageCallback) {
    this.onMessageCallbacks.push(cb);
  }

  public onPeerConnect(cb: ConnectionCallback) {
    this.onConnectCallbacks.push(cb);
  }

  public onServerInfo(cb: ServerInfoCallback) {
    this.onServerInfoCallbacks.push(cb);
    if (this.relayIp) {
      cb(this.relayIp, this.relayPort);
    }
  }

  private detectSensitive(text: string): boolean {
    const trimmed = text.trim();
    if (
      trimmed.length >= 16 &&
      !trimmed.includes(' ') &&
      /[0-9]/.test(trimmed) &&
      /[A-Z]/.test(trimmed)
    ) {
      return true;
    }
    if (
      trimmed.startsWith('ghp_') ||
      trimmed.startsWith('eyJ') ||
      trimmed.startsWith('sk-') ||
      trimmed.startsWith('bearer ')
    ) {
      return true;
    }
    return false;
  }
}
