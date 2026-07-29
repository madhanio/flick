import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

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

  // Invoke Tauri commands when running in Tauri context
  useEffect(() => {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      const { invoke } = (window as any).__TAURI_INTERNALS__;

      invoke('get_node_info').then((info: NodeInfo) => setNodeInfo(info)).catch(() => {});
      invoke('get_paired_devices').then((devices: PairedDevice[]) => setPairedDevices(devices)).catch(() => {});
      invoke('get_recent_flicks').then((flicks: FlickItem[]) => setRecentFlicks(flicks)).catch(() => {});

      // Listen for updates from backend broadcast
      if ((window as any).__TAURI__?.event) {
        const { listen } = (window as any).__TAURI__.event;
        listen('flick-updated', (event: any) => {
          setRecentFlicks((prev) => [event.payload, ...prev]);
        });
      }
    } else {
      setNodeInfo({
        node_id: '',
        device_id: 'dev_pc',
        device_name: 'Windows PC',
      });
      setPairedDevices([]);
      setRecentFlicks([]);
    }
  }, []);

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
    const diffSec = Math.floor(Date.now() / 1000 - ts);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  return (
    <div
      style={{
        backgroundColor: '#F8F9FA',
        color: '#0F172A',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F1F5F9',
              padding: '6px 12px',
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
              <span
                style={{
                  backgroundColor: '#0F4C3A',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {pairedDevices.filter((d) => d.online).length} Online
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pairedDevices.map((dev) => (
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
              ))}
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
                  outline: 'none',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  backgroundColor: '#F8F9FA',
                }}
              />
              <button
                onClick={handleSendFlick}
                style={{
                  backgroundColor: '#C2410C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 20px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Send size={16} />
                <span>Flick</span>
              </button>
            </div>
          </div>

          {/* Recent Flicks History List */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                Recent Flicks History
              </h2>
              <span style={{ fontSize: '12px', color: '#64748B' }}>{recentFlicks.length} Items</span>
            </div>

            {recentFlicks.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                <Clock size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No flicks received yet. Copy text or type above to flick!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentFlicks.map((item) => {
                  const isRevealed = revealedIds.has(item.id);
                  const displayContent = item.sensitive && !isRevealed ? item.preview : item.content;

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8F9FA',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#0F4C3A',
                              color: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {item.from_device_name}
                          </span>
                          {item.sensitive && (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#C2410C',
                                backgroundColor: '#FFEDD5',
                                padding: '2px 8px',
                                borderRadius: '4px',
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
                          color: '#0F172A',
                          wordBreak: 'break-all',
                          lineHeight: '1.5',
                          backgroundColor: '#FFFFFF',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {displayContent}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {item.sensitive && (
                          <button
                            onClick={() => toggleReveal(item.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#475569',
                            }}
                          >
                            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCopy(item.content, item.id)}
                          style={{
                            backgroundColor: copiedId === item.id ? '#0F4C3A' : '#0F172A',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
