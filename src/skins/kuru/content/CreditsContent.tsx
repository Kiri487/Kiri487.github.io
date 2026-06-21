function CreditsContent() {
  return (
    <div className="kuru-term">
      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; cat /credits</span>
          <span className="kuru-term__line" />
        </div>
        <div className="kuru-term__tree">
          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: 3D SCENE</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>
                Model ·· <a href="https://sketchfab.com/" target="_blank" rel="noopener noreferrer">Sketchfab</a> — dirty_street.glb
              </span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span>Engine ·· React Three Fiber + Drei + postprocessing</span>
            </div>
          </div>

          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: BGM</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span className="kuru-term__pending">[PENDING]</span>
            </div>
          </div>

          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: FONTS</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>Sedgwick Ave ·· Google Fonts</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span>Libre Barcode 39 Extended Text ·· Google Fonts</span>
            </div>
          </div>

          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: TEXTURES</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>kiri487_graffiti.png ·· original</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>projects_poster.png ·· original</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>works_sticker.png ·· original</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span>cited_sticker.png ·· original</span>
            </div>
          </div>

          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: TOOLS</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>Vite + React + TypeScript</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">├</span>
              <span>Three.js / R3F</span>
            </div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span>Claude Code ·· co-development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreditsContent;
