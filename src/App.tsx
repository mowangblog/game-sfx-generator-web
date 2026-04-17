import GameSfxGenerator from './components/GameSfxGenerator';

function App() {
  return (
    <div className="page-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <main className="app-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">独立游戏音效实验室</p>
            <h1>复古游戏音效生成器</h1>
            <p className="hero-description">
              为金币、跳跃、爆炸、点击、激光等街机风格音效提供一套快速、直观、可实时试听的浏览器生成工作流。
            </p>
          </div>

          <div className="hero-card">
            <span>定位</span>
            <strong>专注程序化游戏音效</strong>
            <small>已从原多功能工具项目中拆分为真正独立的仓库。</small>
          </div>
        </section>

        <GameSfxGenerator />
      </main>
    </div>
  );
}

export default App;