import GameSfxGenerator from './components/GameSfxGenerator';

const BRAND_ASSET_PATH = `${import.meta.env.BASE_URL}logo.jpg`;
const VIDEO_TIMESHEET_URL = 'https://mowangblog.github.io/video-timesheet-web/';
const SUPPORT_LINKS = [
  {
    id: 'bilibili',
    label: 'B站',
    href: 'https://space.bilibili.com/13406042',
  },
  {
    id: 'douyin',
    label: '抖音',
    href: 'https://www.douyin.com/user/MS4wLjABAAAAycVZEUWkD8Jwx8_Mu5E4TVdR8MkFlX0xNtEhEq5mOQKHeG9m3bDt-Q_PVGkQuDAA',
  },
  {
    id: 'xiaohongshu',
    label: '小红书',
    href: 'https://www.xiaohongshu.com/user/profile/5f7310700000000001002626',
  },
] as const;

type SupportPlatform = (typeof SUPPORT_LINKS)[number]['id'];

function SupportLogo({ platform }: { platform: SupportPlatform }) {
  if (platform === 'bilibili') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="7" width="15" height="10.5" rx="2.8" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8.4 4.5 6.8 6.7M15.6 4.5l1.6 2.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M9.2 11.1v2.2M14.8 11.1v2.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M8.5 15.3c1.1.7 2.2 1 3.5 1 1.3 0 2.4-.3 3.5-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (platform === 'douyin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13.2 4.5c1.2 1.8 2.6 3 4.6 3.6v2.6c-1.5-.1-2.9-.6-4-1.4v5.5a4.7 4.7 0 1 1-4.7-4.6c.4 0 .8 0 1.2.1v2.8a2 2 0 1 0 .8 1.7V4.5h2.1Z"
          fill="currentColor"
        />
        <path
          d="M11.7 4.5v10.3a2 2 0 1 1-2-2c.2 0 .5 0 .7.1v-2.8a4.8 4.8 0 1 0 4.1 4.7V9.3c1.1.8 2.5 1.3 4 1.4V8.1c-2-.6-3.4-1.8-4.6-3.6h-2.2Z"
          fill="#25F4EE"
          opacity="0.9"
        />
        <path
          d="M12.5 4.1c1.2 1.8 2.6 3 4.6 3.6v2.6c-1.5-.1-2.9-.6-4-1.4v5.5a4.7 4.7 0 1 1-4.7-4.6c.4 0 .8 0 1.2.1v2.8a2 2 0 1 0 .8 1.7V4.1h2.1Z"
          fill="#FE2C55"
          opacity="0.88"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="4.2" fill="currentColor" />
      <path
        d="M8 9.1h3.1v1.4H9.7v.8h1.2c1.5 0 2.4.8 2.4 2.1 0 1.4-1 2.3-2.6 2.3H8v-1.4h2.4c.7 0 1.1-.3 1.1-.8s-.4-.8-1.1-.8H8V9.1Zm6.6 0h1.5l-1.4 2.7 1.5 3.9h-1.6l-.8-2.2-.8 2.2h-1.5l1.5-3.9-1.4-2.7h1.5l.7 1.7.8-1.7Z"
        fill="#fff"
      />
    </svg>
  );
}

function App() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="page-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <main className="app-shell">
        <section className="hero">
          <h1 className="hero-title">
            <span className="hero-title__main">复古游戏音效生成器</span>
            <span className="hero-title__version">1.0</span>
          </h1>

          <div className="hero-tool-row">
            <p className="hero-tool-copy">更多工具：</p>
            <div className="hero-links">
              <a
                className="hero-link"
                href={VIDEO_TIMESHEET_URL}
                target="_blank"
                rel="noreferrer"
              >
                视频转序列表
              </a>
            </div>
          </div>

          <div className="hero-support-row">
            <p className="hero-copy">永久免费工具，欢迎一键三连与关注支持更新。</p>
            <div className="hero-links">
              {SUPPORT_LINKS.map((link) => (
                <a
                  key={link.label}
                  className={`hero-link hero-link--${link.id}`}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="hero-link__icon" aria-hidden="true">
                    <SupportLogo platform={link.id} />
                  </span>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <GameSfxGenerator />

        <footer className="app-footer">
          <div className="app-footer__brand">
            <img
              className="app-footer__avatar"
              src={BRAND_ASSET_PATH}
              alt="mowangblog 版权标识"
            />
            <div className="app-footer__copy">
              <strong>© {currentYear} 今天又被 Godot 打了</strong>
              <span>复古游戏音效生成器</span>
            </div>
          </div>
          <p className="app-footer__note">永久免费工具，欢迎一键三连与关注支持更新。</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
