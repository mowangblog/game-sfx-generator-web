import GameSfxGenerator from './components/GameSfxGenerator';

function App() {
  return (
    <div className="page-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <main className="app-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Standalone Retro Audio Lab</p>
            <h1>Retro SFX Lab</h1>
            <p className="hero-description">
              A standalone web app for quickly building coin, jump, explosion,
              click, laser, and other arcade-style game sound effects.
            </p>
          </div>

          <div className="hero-card">
            <span>Purpose</span>
            <strong>Focused procedural game audio</strong>
            <small>Split out from the original multi-tool project into its own repo.</small>
          </div>
        </section>

        <GameSfxGenerator />
      </main>
    </div>
  );
}

export default App;
