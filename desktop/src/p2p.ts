import Peer, { DataConnection } from 'peerjs';
import { FlickMessage, PairedDevice, PairingTicket } from './types';

type MessageCallback = (msg: FlickMessage) => void;
type ConnectionCallback = (device: PairedDevice) => void;

export class FlickP2PService {
  private peer: Peer | null = null;
  private ws: WebSocket | null = null;
  public myPeerId: string = '';
  public deviceId: string = '';
  public deviceName: string = '';
  private connections: Map<string, DataConnection> = new Map();
  private pairedDevicesMap: Map<string, PairedDevice> = new Map();
  private onMessageCallbacks: MessageCallback[] = [];
  private onConnectCallbacks: ConnectionCallback[] = [];

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

  private connectLocalWebSocket() {
    try {
      const host = window.location.hostname || 'localhost';
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
          if (data.type === 'DEVICE_COUNT') {
            if (data.count > 1) {
              const pairedDev: PairedDevice = {
                deviceId: 'dev_mobile_wifi',
                deviceName: 'Android Mobile (Local Wi-Fi)',
                peerId: 'flick_m_wifi',
                pairedAt: Date.now(),
              };
              this.pairedDevicesMap.clear();
              this.pairedDevicesMap.set('flick_m_wifi', pairedDev);
              this.onConnectCallbacks.forEach((cb) => cb(pairedDev));
            } else {
              this.pairedDevicesMap.delete('flick_m_wifi');
              this.onConnectCallbacks.forEach((cb) => cb({
                deviceId: '',
                deviceName: '',
                peerId: '',
                pairedAt: Date.now()
              }));
            }
          } else if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_ACK') {
            const pairedDev: PairedDevice = {
              deviceId: data.deviceId || 'dev_mobile',
              deviceName: data.deviceName || 'Android Mobile',
              peerId: data.peerId || 'mobile_peer',
              pairedAt: Date.now(),
            };
            this.pairedDevicesMap.set(pairedDev.peerId, pairedDev);
            this.onConnectCallbacks.forEach((cb) => cb(pairedDev));
          } else if (data.type === 'FLICK') {
            const msg: FlickMessage = data.payload;
            if (msg && msg.fromDeviceId !== this.deviceId) {
              msg.status = 'received';
              this.onMessageCallbacks.forEach((cb) => cb(msg));
            }
          }
        } catch (_) {}
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
        const pairedDev: PairedDevice = {
          deviceId: data.deviceId || ('dev_' + (data.peerId ? data.peerId.substring(0, 6) : 'mobile')),
          deviceName: data.deviceName || 'Android Mobile',
          peerId: data.peerId || conn.peer,
          pairedAt: Date.now(),
        };
        this.pairedDevicesMap.set(pairedDev.peerId, pairedDev);

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

    conn.on('close', () => {
      this.connections.delete(conn.peer);
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
          deviceName: 'Paired Device',
          peerId: cleanTargetId,
          pairedAt: Date.now(),
        };
        this.pairedDevicesMap.set(cleanTargetId, dev);
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

    // Broadcast over WebSocket Relay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'FLICK',
        payload: message,
      }));
    }

    // Broadcast over WebRTC Connections
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({
          type: 'FLICK',
          payload: message,
        });
      }
    });

    return message;
  }

  public createPairingTicket(): PairingTicket {
    return {
      version: 1,
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
