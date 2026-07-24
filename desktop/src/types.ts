export interface FlickMessage {
  id: string;
  content: string;
  preview: string;
  sensitive: boolean;
  fromDeviceId: string;
  fromDeviceName: string;
  timestamp: number;
  status: 'received' | 'sent';
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  peerId: string;
  pairedAt: number;
}

export interface PairingTicket {
  version: number;
  peerId: string;
  deviceId: string;
  deviceName: string;
  timestamp: number;
}
