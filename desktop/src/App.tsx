import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Smartphone,
  Laptop,
  Copy,
  Check,
  Shield,
  Send,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Clock,
  Radio,
  QrCode,
  X,
  Camera,
  Plus,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface FlickItem {
  id: string;
  msg_type: string;
  content: string;
  preview: string;
  sensitive: boolean;
  from_device_id: string;
  from_device_name: string;
  timestamp: number;
}

interface PairedDevice {
  id: string;
  name: string;
  online: boolean;
  last_seen: number;
}

interface NodeInfo {
  node_id: string;
  device_id: string;
  device_name: string;
}

export const App: React.FC = () => {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [recentFlicks, setRecentFlicks] = useState<FlickItem[]>([]);
  const [inputContent, setInputContent] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Pairing Modal state
  const [isPairModalOpen, setIsPairModalOpen] = useState<boolean>(false);
  const [pairTab, setPairTab] = useState<'qr' | 'scan' | 'manual'>('qr');
  const [manualCode, setManualCode] = useState<string>('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Invoke Tauri commands when running in Tauri context
  useEffect(() => {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      const { invoke } = (window as any).__TAURI_INTERNALS__;

      let interval: any = null;
      const fetchNodeInfo = () => {
        invoke('get_node_info')
          .then((info: NodeInfo | null) => {
            if (info && info.node_id) {
              setNodeInfo(info);
              if (interval) clearInterval(interval);
            }
          })
          .catch(() => {});
      };

      fetchNodeInfo();
      interval = setInterval(fetchNodeInfo, 1000);

      invoke('get_paired_devices').then((devices: PairedDevice[]) => setPairedDevices(devices)).catch(() => {});
      invoke('get_recent_flicks').then((flicks: FlickItem[]) => setRecentFlicks(flicks)).catch(() => {});

      // Listen for updates from backend broadcast
      if ((window as any).__TAURI__?.event) {
        const { listen } = (window as any).__TAURI__.event;
        listen('flick-updated', (event: any) => {
          setRecentFlicks((prev) => [event.payload, ...prev]);
        });
      }

      return () => clearInterval(interval);
    } else {
      setNodeInfo({
        node_id: 'node_pc_desktop_39481',
        device_id: 'dev_pc',
        device_name: 'Windows PC',
      });
      setPairedDevices([]);
      setRecentFlicks([]);
    }
  }, []);

  // Initialize/Clean HTML5 QR Code Scanner when 'scan' tab is open
  useEffect(() => {
    if (isPairModalOpen && pairTab === 'scan') {
      const timeout = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 220, height: 220 } },
          false
        );

        scanner.render(
          (decodedText) => {
            handlePairFromCode(decodedText);
            scanner.clear();
            setIsPairModalOpen(false);
          },
          (error) => {
            // Ignore frame decode errors
          }
        );
        scannerRef.current = scanner;
      }, 300);

      return () => {
        clearTimeout(timeout);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
        }
      };
    }
  }, [isPairModalOpen, pairTab]);

  const handlePairFromCode = (code: string) => {
    let name = 'Paired Mobile';
    let id = code;

    try {
      const parsed = JSON.parse(code);
      if (parsed.deviceName) name = parsed.deviceName;
      if (parsed.peerId || parsed.deviceId) id = parsed.peerId || parsed.deviceId;
    } catch (_) {
      id = code.slice(0, 16);
    }

    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      const { invoke } = (window as any).__TAURI_INTERNALS__;
      invoke('add_peer_command', { code }).catch(() => {});
    }

    const newDev: PairedDevice = {
      id,
      name,
      online: true,
      last_seen: Math.floor(Date.now() / 1000),
    };

    setPairedDevices((prev) => {
      if (prev.some((d) => d.id === id)) return prev;
      return [...prev, newDev];
    });

    setManualCode('');
    setIsPairModalOpen(false);
  };

  const handleSendFlick = async () => {
    if (!inputContent.trim()) return;

    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      const { invoke } = (window as any).__TAURI_INTERNALS__;
      try {
        const newItem: FlickItem = await invoke('send_flick_command', { content: inputContent.trim() });
        setRecentFlicks((prev) => [newItem, ...prev]);
        setInputContent('');
      } catch (err) {
        console.error('Failed to send flick:', err);
      }
    } else {
      const newItem: FlickItem = {
        id: String(Date.now()),
        msg_type: 'clipboard',
        content: inputContent.trim(),
        preview: inputContent.length > 40 ? `${inputContent.slice(0, 40)}...` : inputContent,
        sensitive: inputContent.length > 20 && !inputContent.includes(' '),
        from_device_id: nodeInfo?.device_id || 'dev_pc',
        from_device_name: nodeInfo?.device_name || 'Windows PC',
        timestamp: Math.floor(Date.now() / 1000),
      };
      setRecentFlicks((prev) => [newItem, ...prev]);
      setInputContent('');
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTime = (ts: number) => {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const myTicketPayload = JSON.stringify({
    version: 1,
    peerId: nodeInfo?.node_id || nodeInfo?.device_id || 'dev_pc',
    deviceId: nodeInfo?.device_id || 'dev_pc',
    deviceName: nodeInfo?.device_name || 'Windows PC',
  });

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: '#F8F9FA',
        color: '#0F172A',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Editorial Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: '#0F4C3A',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={20} fill="#FFFFFF" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#0F172A',
              }}
            >
              Flick Desktop
            </h1>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
              {nodeInfo?.device_name || 'Windows PC'} • P2P Encrypted
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsPairModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0F4C3A',
              color: '#FFFFFF',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <QrCode size={16} />
            <span>Pair Device</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F1F5F9',
              padding: '8px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0F4C3A',
            }}
          >
            <Radio size={14} />
            <span>Iroh P2P Active</span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main
        style={{
          flex: 1,
          padding: '28px',
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '24px',
          boxSizing: 'border-box',
        }}
      >
        {/* Sidebar Panel: Paired Devices */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                Paired Devices
              </h2>
              <button
                onClick={() => setIsPairModalOpen(true)}
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#0F4C3A',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pairedDevices.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No devices paired yet. Click <strong>Pair Device</strong> to connect your phone!
                </div>
              ) : (
                pairedDevices.map((dev) => (
                  <div
                    key={dev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#F8F9FA',
                      border: '1px solid #F1F5F9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {dev.name.toLowerCase().includes('mobile') || dev.name.toLowerCase().includes('phone') ? (
                        <Smartphone size={18} color="#0F4C3A" />
                      ) : (
                        <Laptop size={18} color="#0F4C3A" />
                      )}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{dev.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{formatTime(dev.last_seen)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {dev.online ? (
                        <Wifi size={14} color="#0F4C3A" />
                      ) : (
                        <WifiOff size={14} color="#94A3B8" />
                      )}
                      <span
                        style={{
                          height: '8px',
                          width: '8px',
                          borderRadius: '50%',
                          backgroundColor: dev.online ? '#0F4C3A' : '#CBD5E1',
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Node Identity Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '20px',
            }}
          >
            <h2 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
              Node Identity
            </h2>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>
              Device ID: <code style={{ fontFamily: 'JetBrains Mono', color: '#C2410C' }}>{nodeInfo?.device_id || 'dev_pc'}</code>
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', wordBreak: 'break-all', fontFamily: 'JetBrains Mono' }}>
              {nodeInfo?.node_id || 'Connecting to relay...'}
            </div>
          </div>
        </aside>

        {/* Center Panel: Send & Clipboard History */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Flick Input Box */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
              Flick to Paired Devices
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendFlick()}
                placeholder="Paste URL, code snippet, or text to broadcast..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8F9FA',
                  fontSize: '14px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSendFlick}
                style={{
                  backgroundColor: '#C2410C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                }}
              >
                <Send size={16} />
                <span>Flick</span>
              </button>
            </div>
          </div>

          {/* Recent Flicks Feed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                Recent Flicks History
              </h2>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                {recentFlicks.length} Items
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentFlicks.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px border-dashed #CBD5E1',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#64748B',
                  }}
                >
                  <Clock size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>No flicks sent or received yet.</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    Copy content on any paired device to see it appear here.
                  </p>
                </div>
              ) : (
                recentFlicks.map((item) => {
                  const isRevealed = revealedIds.has(item.id);
                  const isCopied = copiedId === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              backgroundColor: '#E6F4EA',
                              color: '#0F4C3A',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {item.from_device_name}
                          </span>
                          {item.sensitive && (
                            <span
                              style={{
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Shield size={12} /> Sensitive
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{formatTime(item.timestamp)}</span>
                      </div>

                      <div
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '13px',
                          backgroundColor: '#F8F9FA',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid #F1F5F9',
                          color: item.sensitive && !isRevealed ? '#94A3B8' : '#0F172A',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                          filter: item.sensitive && !isRevealed ? 'blur(4px)' : 'none',
                          transition: 'filter 0.2s',
                          userSelect: item.sensitive && !isRevealed ? 'none' : 'text',
                        }}
                      >
                        {item.content}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {item.sensitive && (
                          <button
                            onClick={() => toggleReveal(item.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCopy(item.content, item.id)}
                          style={{
                            backgroundColor: isCopied ? '#0F4C3A' : '#0F172A',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>

      {/* PAIR DEVICE MODAL & CAMERA SCANNER */}
      {isPairModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '440px',
              maxWidth: '90vw',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <QrCode color="#0F4C3A" size={22} />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Pair Device</h2>
              </div>
              <button
                onClick={() => setIsPairModalOpen(false)}
                style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <button
                onClick={() => setPairTab('qr')}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderBottom: pairTab === 'qr' ? '2px solid #0F4C3A' : 'none',
                  backgroundColor: 'transparent',
                  color: pairTab === 'qr' ? '#0F4C3A' : '#64748B',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                My QR Code
              </button>
              <button
                onClick={() => setPairTab('scan')}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderBottom: pairTab === 'scan' ? '2px solid #0F4C3A' : 'none',
                  backgroundColor: 'transparent',
                  color: pairTab === 'scan' ? '#0F4C3A' : '#64748B',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Camera size={14} /> Scan Phone
              </button>
              <button
                onClick={() => setPairTab('manual')}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderBottom: pairTab === 'manual' ? '2px solid #0F4C3A' : 'none',
                  backgroundColor: 'transparent',
                  color: pairTab === 'manual' ? '#0F4C3A' : '#64748B',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Manual Code
              </button>
            </div>

            {/* Tab 1: QR Code display */}
            {pairTab === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <QRCodeSVG value={myTicketPayload} size={200} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Scan from your Phone App</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    Open Flick on mobile → Pair → Scan QR
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono',
                    backgroundColor: '#F1F5F9',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    color: '#475569',
                    wordBreak: 'break-all',
                    maxWidth: '100%',
                  }}
                >
                  Ticket ID: {nodeInfo?.node_id || nodeInfo?.device_id || 'Connecting...'}
                </div>
              </div>
            )}

            {/* Tab 2: Camera Scanner */}
            {pairTab === 'scan' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div id="qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Hold your phone's Flick QR code in front of this laptop webcam.
                </span>
              </div>
            )}

            {/* Tab 3: Manual Code Input */}
            {pairTab === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                  Paste Mobile Peer Ticket ID or QR Code String:
                </label>
                <textarea
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder='{"version":1,"peerId":"node_xxx",...}'
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handlePairFromCode(manualCode.trim())}
                  disabled={!manualCode.trim()}
                  style={{
                    backgroundColor: '#0F4C3A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualCode.trim() ? 1 : 0.5,
                  }}
                >
                  Pair Device
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
