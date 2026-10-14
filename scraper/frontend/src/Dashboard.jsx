import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const fmt = (n) => new Intl.NumberFormat().format(n ?? 0);

const PACKS = [
  { id: 'starter', name: 'Starter', thb: 99, satang: 9900, blurb: '1,000 harvests · never expires' },
  { id: 'pro', name: 'Pro', thb: 299, satang: 29900, blurb: '10,000 harvests · priority queue' }
];

const DEBOUNCE_MS = 300;
const DEMO_URL = 'https://example.com';
const DEMO_HARVEST = {
  id: 'demo-' + Date.now(),
  url: DEMO_URL,
  domain: 'example.com',
  title: 'Example Domain',
  description: 'This domain is for use in illustrative examples in documents.',
  h1Count: 1,
  wordCount: 127,
  status: 'ok',
  createdAt: new Date().toISOString()
};
const PAGE_SIZE = 50;

function Toast({ message, type, onClose }) {
  return (
    <div className={`toast ${type}`} role="alert" onClick={onClose}>
      <span>{message}</span>
      <button className="toast-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Delete', confirmClass = 'danger' }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 id="modal-title">{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Tooltip({ children, content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="tooltip-wrapper" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}>
      {children}
      {visible && <span className="tooltip" role="tooltip">{content}</span>}
    </span>
  );
}

function ExportMenu({ items, onClose }) {
  const exportJson = () => {
    const data = items.map(({ id, url, domain, title, description, h1Count, wordCount, createdAt }) => ({
      id, url, domain, title, description, h1Count, wordCount, createdAt
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest-ledger-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };
  const exportMd = () => {
    const lines = items.map((it) => 
      `## ${it.title || '(untitled)'}\n\n` +
      `- **URL:** ${it.url}\n` +
      `- **Domain:** ${it.domain}\n` +
      `- **Words:** ${it.wordCount} | **H1s:** ${it.h1Count}\n` +
      `- **ID:** ${it.id}\n` +
      `- **Harvested:** ${new Date(it.createdAt).toLocaleString()}\n`
    ).join('\n---\n\n');
    const blob = new Blob([`# Harvest Ledger Export\n\n${lines}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest-ledger-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };
  return (
    <div className="export-menu" role="menu">
      <button role="menuitem" onClick={exportJson}>Export JSON</button>
      <button role="menuitem" onClick={exportMd}>Export Markdown</button>
      <button role="menuitem" className="cancel" onClick={onClose}>Cancel</button>
    </div>
  );
}

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState([]);
  const [credits, setCredits] = useState(null);
  const [freeTier, setFreeTier] = useState(null);
  const [stats, setStats] = useState({ total: 0, today: 0, avgWordCount: 0, topDomains: [] });
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lastScrapeUrl, setLastScrapeUrl] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterToday, setFilterToday] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [urlValid, setUrlValid] = useState(null);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const toastTimeouts = useRef(new Map());
  const searchTimeout = useRef(null);
  const exportMenuRef = useRef(null);

  const showToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimeouts.current.delete(id);
    }, 5000);
    toastTimeouts.current.set(id, timeout);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = toastTimeouts.current.get(id);
    if (timeout) { clearTimeout(timeout); toastTimeouts.current.delete(id); }
  }, []);

  const refresh = useCallback(async (query = debouncedQ, filter = filterToday, limit = displayedCount) => {
    try {
      const [list, s, c] = await Promise.all([
        api.list(query, limit),
        api.stats(),
        api.credits()
      ]);
      let filtered = list;
      if (filter) {
        const today = new Date().toISOString().slice(0, 10);
        filtered = list.filter((it) => (it.createdAt || '').slice(0, 10) === today);
      }
      setItems(filtered);
      setStats(s);
      setCredits(c.balance);
      if (c.freeTier) setFreeTier({ remaining: c.freeTier.remaining });
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, [debouncedQ, filterToday, displayedCount, showToast]);

  useEffect(() => {
    refresh('', false, PAGE_SIZE);
    const t = setInterval(() => refresh(debouncedQ, filterToday, displayedCount), 15000);
    return () => clearInterval(t);
  }, [refresh, debouncedQ, filterToday, displayedCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      showToast('Payment received — credits stamped. ขอบคุณที่อุดหนุน!', 'success');
    } else if (params.get('canceled') === '1') {
      showToast('Checkout canceled — no charge made.', 'info');
    }
    if (params.has('paid') || params.has('canceled')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (toasts.length) dismissToast(toasts[0].id);
        if (deleteTarget) setDeleteTarget(null);
        if (showExport) setShowExport(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts.length, deleteTarget, showExport, dismissToast]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedQ(q);
      setDisplayedCount(PAGE_SIZE);
    }, DEBOUNCE_MS);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [q]);

  // URL live validation
  useEffect(() => {
    if (!url.trim()) { setUrlValid(null); return; }
    try {
      const u = new URL(url.trim());
      setUrlValid(u.protocol === 'http:' || u.protocol === 'https:');
    } catch { setUrlValid(false); }
  }, [url]);

  async function onScrape(e) {
    e.preventDefault();
    if (!url.trim()) {
      showToast('Paste a URL first — the ledger needs something to harvest.', 'error');
      return;
    }
    if (urlValid === false) {
      showToast('Invalid URL — must start with http:// or https://', 'error');
      return;
    }
    const targetUrl = url.trim();
    setLastScrapeUrl(targetUrl);
    setLoading(true);
    if (credits !== null && credits > 0) {
      setCredits((c) => c !== null ? c - 1 : c);
    }
    try {
      const doc = await api.scrape(targetUrl);
      showToast(`Harvested "${doc.title || doc.domain}" — stamped into the ledger.`, 'success');
      setUrl('');
      setUrlValid(null);
      await refresh('');
    } catch (e) {
      if (credits !== null) {
        setCredits((c) => c !== null ? c + 1 : c);
      }
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function onRetry() {
    if (lastScrapeUrl) {
      setUrl(lastScrapeUrl);
      setLastScrapeUrl('');
    }
  }

  async function onSearch(e) {
    e.preventDefault();
    setDebouncedQ(q);
    setDisplayedCount(PAGE_SIZE);
    setSearchLoading(true);
    try {
      await refresh(q, filterToday, PAGE_SIZE);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadMore() {
    setLoadMoreLoading(true);
    const nextCount = displayedCount + PAGE_SIZE;
    setDisplayedCount(nextCount);
    try {
      await refresh(debouncedQ, filterToday, nextCount);
    } finally {
      setLoadMoreLoading(false);
    }
  }

  function openDeleteConfirm(id) {
    setDeleteTarget(id);
  }

  function closeDeleteConfirm() {
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.remove(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      const s = await api.stats();
      setStats(s);
      showToast('Harvest deleted.', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function buy(pack) {
    setBuying(pack.id);
    try {
      const base = window.location.origin + window.location.pathname;
      const session = await api.checkout(
        pack.satang,
        `${base}?paid=1`,
        `${base}?canceled=1`
      );
      if (!session.url) throw new Error('No checkout URL returned');
      window.location.href = session.url;
    } catch (e) {
      showToast(e.message, 'error');
      setBuying(null);
    }
  }

  function fillDemoUrl() {
    setUrl(DEMO_URL);
    showToast('Demo URL filled — press Enter to harvest', 'info');
  }

  function loadDemoHarvest() {
    setItems((prev) => [DEMO_HARVEST, ...prev.filter((it) => !it.id.startsWith('demo-'))]);
    showToast('Demo harvest added (local only)', 'success');
  }

  const hasMore = items.length >= displayedCount;
  const visibleItems = items.slice(0, displayedCount);

  return (
    <div className="sovereign">
      <header className="masthead">
        <div className="brand">
          <span className="seal">◈</span>
          <div>
            <p className="eyebrow">Project Sovereign Origin · Micro-SaaS</p>
            <h1>Content Harvest Ledger</h1>
          </div>
        </div>
        <p className="lede">
          Automated scraper dashboard — paste a link, stamp it into the manifest,
          search the harvest.
        </p>
      </header>

      <section className="stat-row" aria-label="Harvest statistics">
        <div className="stat"><span className="k">Total harvests</span><strong>{fmt(stats.total)}</strong></div>
        <div className="stat clickable" onClick={() => { setFilterToday(!filterToday); showToast(filterToday ? 'Showing all harvests' : 'Filtered to today only', 'info'); }}>
          <span className="k">Today</span><strong>{fmt(stats.today)}</strong>
          <span className="stat-hint">Click to toggle</span>
        </div>
        <div className="stat"><span className="k">Avg words</span><strong>{fmt(stats.avgWordCount)}</strong></div>
        <div className="stat wide">
          <span className="k">Top domains</span>
          <strong className="domains">
            {stats.topDomains?.length
              ? stats.topDomains.map((d) => `${d.domain} ×${d.count}`).join(' · ')
              : '—'}
          </strong>
        </div>
      </section>

      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => dismissToast(t.id)} />
        ))}
      </div>

      <main className="grid">
        <form className="card scrape" onSubmit={onScrape}>
          <h2>New harvest</h2>
          <p className="balance mono">
            {credits === null ? '…' : `Balance: ${fmt(credits)} harvest${credits === 1 ? '' : 's'} left`}
            {freeTier && freeTier.remaining > 0 && (
              <Tooltip content="Free tier: 3 harvests per IP. Resets when the server restarts.">
                <span className="free-badge"> · {freeTier.remaining} free left</span>
              </Tooltip>
            )}
          </p>
          <label htmlFor="url">Source URL</label>
          <input
            id="url"
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !loading && credits > 0) { e.preventDefault(); onScrape(e); }}}
            disabled={loading}
            className={urlValid === false ? 'invalid' : urlValid === true ? 'valid' : ''}
            aria-invalid={urlValid === false}
          />
          <div className="scrape-actions">
            <button type="submit" disabled={loading || credits === 0 || urlValid === false}>
              {loading ? 'Harvesting…' : credits === 0 ? 'Out of credits — top up below' : urlValid === false ? 'Fix URL first' : 'Scrape & stamp (1 credit)'}
            </button>
            {lastScrapeUrl && !loading && credits > 0 && (
              <button type="button" className="retry" onClick={onRetry}>Retry last URL</button>
            )}
          </div>
          <p className="hint">
            API: <code>{import.meta.env.VITE_API_URL || 'http://localhost:4000'}</code>
            {items.length === 0 && <span className="demo-hint"> · <button type="button" className="link-btn" onClick={fillDemoUrl}>Try example.com</button> or <button type="button" className="link-btn" onClick={loadDemoHarvest}>Load demo</button></span>}
          </p>
        </form>

        <section className="card manifest">
          <div className="manifest-head">
            <h2>Manifest {filterToday && <span className="filter-badge">Today only</span>}</h2>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <form onSubmit={onSearch} className="search">
                <input
                  placeholder="Search title, URL…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search harvests"
                  disabled={searchLoading}
                />
                <button type="submit" disabled={searchLoading}>
                  {searchLoading ? 'Searching…' : 'Search'}
                </button>
              </form>
              {items.length > 0 && (
                <div className="export-dropdown">
                  <button className="export-btn" onClick={() => setShowExport(!showExport)} aria-haspopup="true" aria-expanded={showExport}>
                    Export ▾
                  </button>
                  {showExport && <ExportMenu items={items} onClose={() => setShowExport(false)} />}
                </div>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <p className="empty">Ledger is empty — harvest your first URL to begin.</p>
              <div className="empty-actions">
                <button type="button" className="link-btn" onClick={fillDemoUrl}>Paste example.com</button>
                <button type="button" className="link-btn" onClick={loadDemoHarvest}>Load demo harvest</button>
              </div>
            </div>
          ) : (
            <>
              <ul className="rows">
                {visibleItems.map((it) => (
                  <li key={it.id} className="row">
                    <div className="row-main">
                      <p className="title">{it.title || '(untitled)'}</p>
                      <p className="meta mono">{it.domain} · {it.wordCount} words · {it.h1Count} h1</p>
                      <div className="row-links">
                        <a className="mono link" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>
                        <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(it.url); showToast('URL copied', 'info'); }} title="Copy URL">Copy URL</button>
                        <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(it.id); showToast('ID copied', 'info'); }} title="Copy ID">Copy ID</button>
                        <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(it.title || ''); showToast('Title copied', 'info'); }} title="Copy title">Copy title</button>
                      </div>
                      <p className="mono id">#{it.id.slice(0, 8)}</p>
                    </div>
                    <div className="row-side">
                      <span className="stamp">cleared</span>
                      <button className="danger" onClick={() => openDeleteConfirm(it.id)} type="button">
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button className="load-more" onClick={loadMore} disabled={loadMoreLoading}>
                  {loadMoreLoading ? 'Loading…' : `Load ${PAGE_SIZE} more`}
                </button>
              )}
            </>
          )}
        </section>
      </main>

      <section className="card pricing" id="pricing" aria-label="Credit packs">
        <h2>Top up credits — pay in THB</h2>
        <p className="sub">Secure checkout via Stripe. บาทไทยเท่านั้น.</p>
        <div className="packs">
          {PACKS.map((p) => (
            <div key={p.id} className="pack">
              <p className="pack-name">{p.name}</p>
              <p className="pack-price">฿{p.thb}</p>
              <p className="pack-blurb mono">{p.blurb}</p>
              <button
                type="button"
                onClick={() => buy(p)}
                disabled={buying !== null}
              >
                {buying === p.id ? 'Opening Stripe…' : `Buy ${p.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete harvest?"
        message="This action cannot be undone. The harvest will be permanently removed from your ledger."
        onConfirm={confirmDelete}
        onCancel={closeDeleteConfirm}
        confirmLabel="Delete permanently"
        confirmClass="danger"
      />

      <footer className="foot mono">
        Sovereign Scraper · self-hosted · data stays on your server
      </footer>
    </div>
  );
}