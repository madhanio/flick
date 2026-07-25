import Peer, { DataConnection } from 'peerjs';
import { FlickMessage, PairedDevice, PairingTicket } from './types';

type MessageCallback = (msg: FlickMessage) => void;
type ConnectionCallback = (device: PairedDevice) => void;

export class FlickP2PService {
  private peer: Peer | null = null;
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
    return new Promise((resolve) => {
      const cleanId = 'flick_' + Math.random().toString(36).substring(2, 10);
      this.peer = new Peer(cleanId, {
        debug: 1,
      });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log('⚡ Flick P2P Ready! My Peer ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('P2P connection warning:', err);
      });
    });
  }

  private handleConnection(conn: DataConnection) {
    // Store active connection
    this.connections.set(conn.peer, conn);

    const setupListeners = (c: DataConnection) => {
      // Remove any existing listeners to avoid duplicate handler fires
      c.off('data');
      c.on('data', (raw: any) => {
        if (!raw) return;
        let data = raw;
        if (typeof raw === 'string') {
          try {
            data = JSON.parse(raw);
          } catch (_) {
            data = raw;
          }
        }

        if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_ACK') {
          const pairedDev: PairedDevice = {
            deviceId: data.deviceId || ('dev_' + data.peerId.substring(0, 6)),
            deviceName: data.deviceName || 'Android Mobile',
            peerId: data.peerId,
            pairedAt: Date.now(),
          };
          this.pairedDevicesMap.set(data.peerId, pairedDev);

          if (data.type === 'HANDSHAKE') {
            c.send({
              type: 'HANDSHAKE_ACK',
              deviceId: this.deviceId,
              deviceName: this.deviceName,
              peerId: this.myPeerId,
            });
          }

          this.onConnectCallbacks.forEach((cb) => cb(pairedDev));
        } else if (data.type === 'FLICK') {
          const msg: FlickMessage = data.payload;
          if (!msg) return;
          // Ignore self-reflected messages
          if (msg.fromDeviceId === this.deviceId) {
            return;
          }
          msg.status = 'received';
          this.onMessageCallbacks.forEach((cb) => cb(msg));
        }
      });

      c.on('close', () => {
        this.connections.delete(c.peer);
      });
    };

    if (conn.open) {
      conn.send({
        type: 'HANDSHAKE',
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        peerId: this.myPeerId,
      });
      setupListeners(conn);
    } else {
      conn.on('open', () => {
        conn.send({
          type: 'HANDSHAKE',
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          peerId: this.myPeerId,
        });
        setupListeners(conn);
      });
    }
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

    // Broadcast to all active open connections
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
