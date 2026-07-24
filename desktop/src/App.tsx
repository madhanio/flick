import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Zap,
  QrCode,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Shield,
  Wifi,
  Send,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { FlickP2PService } from './p2p';
import { FlickMessage, PairedDevice, PairingTicket } from './types';

export const App: React.FC = () => {
  const [p2p, setP2p] = useState<FlickP2PService | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'flicks' | 'pair' | 'devices'>('flicks');
  const [flickText, setFlickText] = useState<string>('');
  const [messages, setMessages] = useState<FlickMessage[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  
  // Mode B Toast State
  const [incomingToast, setIncomingToast] = useState<FlickMessage | null>(null);
  const [toastRevealed, setToastRevealed] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Manual Ticket State
  const [manualTicket, setManualTicket] = useState<string>('');
  const [pairingStatus, setPairingStatus] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    const service = new FlickP2PService();
    service.initialize().then((id) => {
      setPeerId(id);
      setP2p(service);
    });

    service.onMessage((msg) => {
      setMessages((prev) => [msg, ...prev]);
      setIncomingToast(msg);
      setToastRevealed(false);
    });

    service.onPeerConnect((device) => {
      setPairedDevices(service.getPairedDevices());
      setPairingStatus(`✅ Paired with ${device.deviceName}!`);
    });
  }, []);

  const handleSendFlick = () => {
    if (!p2p || !flickText.trim()) return;
    const msg = p2p.broadcastFlick(flickText.trim());
    setMessages((prev) => [msg, ...prev]);
    setFlickText('');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAcceptToast = (msg: FlickMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setIncomingToast(null);
  };

  const handlePairManual = async () => {
    if (!p2p || !manualTicket.trim()) return;
    try {
      setPairingStatus('Connecting...');
      let targetPeerId = manualTicket.trim();
      if (manualTicket.includes('{')) {
        const ticket: PairingTicket = JSON.parse(manualTicket);
        targetPeerId = ticket.peerId;
      }
      const dev = await p2p.connectToPeer(targetPeerId);
      setPairedDevices(p2p.getPairedDevices());
      setPairingStatus(`✅ Connected to ${dev.deviceName}!`);
      setManualTicket('');
    } catch (err) {
      setPairingStatus(`❌ Connection failed.`);
    }
  };

  // QR Scanner Effect
  useEffect(() => {
    if (!isScanning) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 240, height: 240 } },
      false
    );

    scanner.render(
      (decodedText) => {
        setManualTicket(decodedText);
        setIsScanning(false);
        scanner.clear();
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [isScanning]);

  const qrPayload = p2p ? JSON.stringify(p2p.createPairingTicket()) : '';

  return (
    <div className="app-container">
      {/* Mode B Toast Notification */}
      {incomingToast && (
        <div className="mode-b-toast">
          <div className="toast-header">
            <div className="toast-sender">
              <Zap size={18} />
              <span>Incoming Flick from {incomingToast.fromDeviceName}</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setIncomingToast(null)}>
              <X size={14} />
            </button>
          </div>

          <div
            className={`toast-preview ${incomingToast.sensitive && !toastRevealed ? 'sensitive' : ''}`}
            onClick={() => setToastRevealed(true)}
          >
            {incomingToast.sensitive && !toastRevealed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} />
                <span>Sensitive content hidden — tap to reveal preview</span>
              </div>
            ) : (
              incomingToast.content
            )}
          </div>

          <div className="toast-actions">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleAcceptToast(incomingToast)}>
              <Copy size={16} />
              <span>Copy to Clipboard</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIncomingToast(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Concept 1 Header */}
      <header className="header">
        <div className="brand">
          <div className="logo-badge">⚡</div>
          <div>
            <div className="brand-title">Flick</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              End-to-End P2P Clipboard Sync
            </div>
          </div>
        </div>

        <div className="status-badge">
          <div className="status-dot"></div>
          <Wifi size={15} />
          <span>Local Wi-Fi P2P Active</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'flicks' ? 'active' : ''}`}
          onClick={() => setActiveTab('flicks')}
        >
          <Zap size={16} />
          <span>Flicks ({messages.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'pair' ? 'active' : ''}`}
          onClick={() => setActiveTab('pair')}
        >
          <QrCode size={16} />
          <span>Pair Device</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          <Smartphone size={16} />
          <span>Devices ({pairedDevices.length})</span>
        </button>
      </div>

      {/* TAB 1: FLICKS LIST & SEND BOX */}
      {activeTab === 'flicks' && (
        <div>
          {/* Flick Send Card */}
          <div className="card">
            <div className="card-title">
              <Zap size={20} color="var(--accent-flick)" />
              <span>Flick New Content</span>
            </div>

            <textarea
              className="flick-textarea"
              placeholder="Paste text, link, code snippet, or password to flick to paired devices..."
              value={flickText}
              onChange={(e) => setFlickText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSendFlick();
                }
              }}
            />

            <div className="send-actions">
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Tip: Press Ctrl+Enter to send instantly
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSendFlick}
                disabled={!flickText.trim()}
              >
                <Send size={16} />
                <span>Flick Content</span>
              </button>
            </div>
          </div>

          {/* Flick History Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                <span>Clipboard Stream</span>
              </div>

              {messages.length > 0 && (
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setMessages([])}>
                  <Trash2 size={14} />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Zap size={36} color="var(--border)" style={{ marginBottom: '12px' }} />
                <div style={{ fontWeight: 700, fontSize: '15px' }}>No flicks yet</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Flick text above or pair a phone to receive incoming clipboard items.
                </div>
              </div>
            ) : (
              <div className="history-list">
                {messages.map((msg) => (
                  <div className="history-item" key={msg.id}>
                    <div style={{ flex: 1, paddingRight: '20px' }}>
                      <div className="history-meta">
                        <span style={{ fontWeight: 700, color: msg.status === 'sent' ? 'var(--accent-flick)' : 'var(--accent-primary)' }}>
                          {msg.status === 'sent' ? '📤 Outgoing Flick' : `📥 From ${msg.fromDeviceName}`}
                        </span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                        {msg.sensitive && (
                          <span style={{ backgroundColor: '#FEF2F2', color: '#991B1B', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            🔒 Sensitive
                          </span>
                        )}
                      </div>

                      <div className="history-content">{msg.content}</div>
                    </div>

                    <button className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => handleCopy(msg.content, msg.id)}>
                      {copiedId === msg.id ? (
                        <>
                          <Check size={15} color="var(--green)" />
                          <span style={{ color: 'var(--green)' }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={15} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PAIR DEVICE */}
      {activeTab === 'pair' && (
        <div>
          <div className="card">
            <div className="card-title">
              <QrCode size={20} color="var(--accent-primary)" />
              <span>Scan QR Code to Pair Phone</span>
            </div>

            <div className="qr-container">
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Open this web app on your phone's browser and scan this QR code:
              </div>

              <div className="qr-box">
                {qrPayload ? <QRCodeSVG value={qrPayload} size={220} level="M" /> : <div>Generating QR Code...</div>}
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Local Peer Ticket ID:</div>
                <div className="mono" style={{ fontSize: '14px', fontWeight: 700 }}>
                  {peerId || 'Initializing...'}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <Smartphone size={20} color="var(--accent-flick)" />
              <span>Scan or Enter Peer Ticket</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <button className="btn btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => setIsScanning(!isScanning)}>
                <QrCode size={16} />
                <span>{isScanning ? 'Close Camera Scanner' : '📷 Open Camera Scanner'}</span>
              </button>

              {isScanning && <div id="qr-reader" style={{ marginTop: '16px', borderRadius: '12px', overflow: 'hidden' }}></div>}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Or manually paste Laptop Peer ID below:</div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input
                type="text"
                className="flick-textarea"
                style={{ minHeight: 'auto', padding: '12px', flex: 1 }}
                placeholder="Paste Peer ID (e.g. flick_abc123)..."
                value={manualTicket}
                onChange={(e) => setManualTicket(e.target.value)}
              />

              <button className="btn btn-primary" onClick={handlePairManual}>
                <Plus size={16} />
                <span>Pair</span>
              </button>
            </div>

            {pairingStatus && (
              <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 700, color: pairingStatus.startsWith('✅') ? 'var(--green)' : 'var(--accent-flick)' }}>
                {pairingStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PAIRED DEVICES */}
      {activeTab === 'devices' && (
        <div className="card">
          <div className="card-title">
            <Smartphone size={20} color="var(--accent-primary)" />
            <span>Paired Devices</span>
          </div>

          {pairedDevices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Smartphone size={36} color="var(--border)" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: 700, fontSize: '15px' }}>No paired devices yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                Go to the "Pair Device" tab to pair your phone and laptop over Wi-Fi.
              </div>
            </div>
          ) : (
            <div>
              {pairedDevices.map((dev) => (
                <div key={dev.deviceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'var(--bg-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                      {dev.deviceName.toLowerCase().includes('phone') ? <Smartphone size={22} /> : <Laptop size={22} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{dev.deviceName}</div>
                      <div className="mono" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {dev.peerId}
                      </div>
                    </div>
                  </div>

                  <div className="status-badge" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <div className="status-dot"></div>
                    <span>Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
