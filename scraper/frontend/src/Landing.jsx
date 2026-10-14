import { Link } from 'react-router-dom';

const fmt = (n) => new Intl.NumberFormat().format(n);

const USE_CASES = [
  {
    icon: '📰',
    title: 'Journalists & Researchers',
    headline: 'Research 50 sources in 5 minutes',
    desc: 'Paste URLs → get title, word count, H1 structure, description → search by keyword → export JSON for analysis.',
    steps: [
      'Paste a source URL, press Enter — metadata is stamped in one click.',
      'Repeat for the rest of your list; only successful scrapes spend a credit.',
      'Search a keyword to pull a source back, or copy its URL/ID inline.'
    ],
    cta: 'Try free (3 credits)'
  },
  {
    icon: '🔍',
    title: 'SEO Specialists',
    headline: 'Competitor content audit without code',
    desc: 'Scrape landing pages → see H1 count, word count, meta description → export Markdown for content briefs.',
    steps: [
      'Drop in each competitor URL and scrape the page.',
      'Read word count + H1 count straight off the manifest row.',
      'Export Markdown and paste it into your content brief.'
    ],
    cta: 'Try free (3 credits)'
  },
  {
    icon: '💻',
    title: 'Developers',
    headline: 'Test your selectors in seconds',
    desc: 'Paste URL → see parsed output instantly → validate cheerio/puppeteer logic without running scripts.',
    steps: [
      'Paste the URL your scraper is about to hit.',
      'Inspect the parsed title, H1s, description and word count.',
      'Export JSON and use it as the fixture for your own tests.'
    ],
    cta: 'Try free (3 credits)'
  },
  {
    icon: '🧠',
    title: 'Knowledge Workers',
    headline: 'Bookmark with brains',
    desc: 'Save structured metadata, not just links → search your harvest later by title, domain, or keyword.',
    steps: [
      'Stamp every worthwhile article into the manifest as you browse.',
      'Search by title, domain or keyword whenever you need it back.',
      'Prune stale entries — deletion asks for confirmation first.'
    ],
    cta: 'Try free (3 credits)'
  },
  {
    icon: '📊',
    title: 'Content Teams',
    headline: 'Audit 200 blog posts in one sitting',
    desc: 'Batch scrape → export JSON → pivot table word count, H1 usage, thin content detection.',
    steps: [
      'Top up Starter ฿99 for 1,000 harvests, then batch the whole blog.',
      'Click TODAY in the stats to scope the run to a single day.',
      'Export JSON and pivot on word count to surface thin content.'
    ],
    cta: 'Starter ฿99 (1,000)'
  }
];

const PRICING = [
  {
    name: 'Free Tier',
    price: '฿0',
    credits: '3 credits',
    period: 'per IP',
    features: [
      '3 harvests to try',
      'Resets on server restart',
      'Full dashboard access',
      'Export JSON & Markdown'
    ],
    cta: 'Start harvesting',
    href: '/app',
    variant: 'outline'
  },
  {
    name: 'Starter',
    price: '฿99',
    credits: '1,000 credits',
    period: 'one-time',
    features: [
      '1,000 harvests',
      'Never expires',
      'Priority support',
      'Export JSON & Markdown'
    ],
    cta: 'Buy Starter',
    href: '/app#pricing',
    variant: 'primary',
    popular: true
  },
  {
    name: 'Pro',
    price: '฿299',
    credits: '10,000 credits',
    period: 'one-time',
    features: [
      '10,000 harvests',
      'Never expires',
      'Priority queue',
      'Export JSON & Markdown'
    ],
    cta: 'Buy Pro',
    href: '/app#pricing',
    variant: 'primary'
  }
];

const FAQ = [
  {
    q: 'What exactly does Sovereign Scraper do?',
    a: 'Paste any article URL and the API harvests its title, description, word count, H1 count, and domain into a searchable ledger. You can then search, filter, and export your data as JSON or Markdown.'
  },
  {
    q: 'How do credit top-ups work?',
    a: 'Buy Starter (฿99 = 1,000 credits) or Pro (฿299 = 10,000 credits) packs through Stripe Checkout. All charges are in Thai Baht (THB). Credits never expire and are added instantly via verified webhooks.'
  },
  {
    q: 'What counts as one credit?',
    a: 'One successful scrape (HTTP 200 + parsed content) spends 1 credit. Failed scrapes (400, 402, 502) do not consume credits. Invalid URLs are rejected before any credit is spent.'
  },
  {
    q: 'Does it work on JavaScript-rendered sites (React, Vue, Next.js)?',
    a: 'No. The scraper fetches static HTML only. Sites that require JavaScript to render content (SPAs, infinite scroll, client-side routing) will return minimal or empty metadata.'
  },
  {
    q: 'Is my payment secure?',
    a: 'Cards are processed by Stripe. Our servers only store the publishable key and verified webhook receipts — never card numbers. All transactions are in THB.'
  },
  {
    q: 'What are the technical limits?',
    a: 'Max HTML size: 2 MB. Request timeout: 8 seconds. Rate limit: 20 requests per 10 seconds per IP. Free tier: 3 credits per IP (resets on server restart).'
  },
  {
    q: 'Can I get a refund?',
    a: 'Credits are non-refundable once granted via Stripe webhook. However, if a technical error prevents credits from being applied, contact us with the Stripe session ID and we\'ll investigate.'
  }
];

export default function Landing() {
  return (
    <div className="landing">
      {/* Hero */}
      <header className="landing-hero">
        <div className="landing-container">
          <div className="hero-badge">Micro-SaaS · Pay per use · No subscription</div>
          <h1>Scrape. Structure. Export.</h1>
          <p className="hero-sub">
            The only no-code dashboard that turns any URL into structured metadata 
            (title, word count, H1s, description) in one click.
          </p>
          <div className="hero-cta">
            <Link to="/app" className="btn btn-primary btn-lg">Try free — 3 credits</Link>
            <Link to="#pricing" className="btn btn-outline btn-lg">View pricing</Link>
          </div>
          <p className="hero-trust">No card required · THB only · Powered by Stripe</p>
        </div>
      </header>

      {/* Demo Preview */}
      <section className="landing-demo" id="demo">
        <div className="landing-container">
          <h2>See it in action</h2>
          <div className="demo-placeholder" aria-label="Dashboard preview">
            <div className="demo-frame">
              <div className="demo-header">
                <div className="demo-dots"><span></span><span></span><span></span></div>
                <div className="demo-url">https://example.com/article</div>
              </div>
              <div className="demo-manifest">
                <div className="demo-row">
                  <span className="demo-title">Example Domain</span>
                  <span className="demo-meta">example.com · 127 words · 1 h1</span>
                </div>
                <div className="demo-row">
                  <span className="demo-title">Getting Started with SEO</span>
                  <span className="demo-meta">moz.com · 2,841 words · 4 h1</span>
                </div>
                <div className="demo-row">
                  <span className="demo-title">The Future of AI</span>
                  <span className="demo-meta">techcrunch.com · 1,523 words · 3 h1</span>
                </div>
              </div>
              <div className="demo-actions">
                <span className="demo-btn">Export JSON</span>
                <span className="demo-btn">Export Markdown</span>
              </div>
            </div>
            <p className="demo-caption">Real dashboard — try it at <Link to="/app">/app</Link></p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="landing-use-cases" id="use-cases">
        <div className="landing-container">
          <div className="section-header">
            <h2>Built for your workflow</h2>
            <p>Five ways professionals use Sovereign Scraper daily</p>
          </div>
          <div className="use-cases-grid">
            {USE_CASES.map((uc, i) => (
              <article key={i} className="use-case-card">
                <span className="use-case-icon">{uc.icon}</span>
                <h3>{uc.title}</h3>
                <h4>{uc.headline}</h4>
                <p>{uc.desc}</p>
                <ol className="use-case-steps" aria-label={`How to use — ${uc.title}`}>
                  {uc.steps.map((s, si) => <li key={si}>{s}</li>)}
                </ol>
                <Link to="/app" className="use-case-cta">{uc.cta} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how" id="how-it-works">
        <div className="landing-container">
          <div className="section-header">
            <h2>How it works</h2>
            <p>Three steps from URL to structured data</p>
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <h3>Paste a URL</h3>
                <p>Any article, blog post, or landing page. No selectors, no config.</p>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <h3>Harvest metadata</h3>
                <p>We fetch, parse, and extract: title, description, word count, H1s, domain.</p>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <h3>Search & export</h3>
                <p>Filter your ledger, search by keyword, download JSON or Markdown.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section className="landing-pricing" id="pricing">
        <div className="landing-container">
          <div className="section-header">
            <h2>Simple, fair pricing</h2>
            <p>No subscriptions. Credits never expire. Pay once, use forever.</p>
          </div>
          <div className="pricing-grid">
            {PRICING.map((p, i) => (
              <article key={i} className={`pricing-card ${p.variant} ${p.popular ? 'popular' : ''}`}>
                {p.popular && <span className="popular-badge">Most popular</span>}
                <h3>{p.name}</h3>
                <div className="price-row">
                  <span className="price">{p.price}</span>
                  <span className="credits">{p.credits}</span>
                </div>
                <p className="period">{p.period}</p>
                <ul className="features">
                  {p.features.map((f, j) => (
                    <li key={j}>✓ {f}</li>
                  ))}
                </ul>
                <Link to={p.href} className={`btn ${p.variant === 'primary' ? 'btn-primary' : 'btn-outline'} btn-block`}>
                  {p.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-faq" id="faq">
        <div className="landing-container">
          <div className="section-header">
            <h2>Frequently asked questions</h2>
          </div>
          <dl className="faq-list">
            {FAQ.map((item, i) => (
              <div key={i} className="faq-item">
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="seal">◈</span>
              <strong>Sovereign Scraper</strong>
              <p>Content Harvest Ledger — Micro-SaaS</p>
            </div>
            <nav>
              <h4>Product</h4>
              <ul>
                <li><Link to="/app">Dashboard</Link></li>
                <li><Link to="#pricing">Pricing</Link></li>
                <li><Link to="#faq">FAQ</Link></li>
              </ul>
            </nav>
            <nav>
              <h4>Company</h4>
              <ul>
                <li><a href="https://github.com/krisakornutama/Project-Github-Work" target="_blank" rel="noreferrer">GitHub</a></li>
                <li><a href="https://fastwork.co/user/krisakorn46" target="_blank" rel="noreferrer">Fastwork</a></li>
              </ul>
            </nav>
            <nav>
              <h4>Legal</h4>
              <ul>
                <li><a href="/privacy">Privacy</a></li>
                <li><a href="/terms">Terms</a></li>
              </ul>
            </nav>
          </div>
          <div className="footer-bottom">
            <p>Canonical: <a href="https://harvest-ledger.pages.dev">harvest-ledger.pages.dev</a></p>
            <p>Deployed on Vercel + Railway · Built with React 19, Vite, Express, Stripe</p>
          </div>
        </div>
      </footer>
    </div>
  );
}