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
                Model ·· <a href="https://sketchfab.com/3d-models/dirty-street-6e6b61361f5e483484f4c8b924a0beee" target="_blank" rel="noopener noreferrer">Dirty Street</a> By Melissa Descubes
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
              <span>
                Music by{" "}
                <a href="https://pixabay.com/users/tunetank-50201703/" target="_blank" rel="noopener noreferrer">Tunetank</a>
                {" "}from{" "}
                <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer">Pixabay</a>
              </span>
            </div>
          </div>

          <div className="kuru-term__group">
            <div className="kuru-term__group-cat">:: FONTS</div>
            <div className="kuru-term__group-item">
              <span className="kuru-term__prefix">└</span>
              <span><a href="https://fonts.google.com/specimen/Libre+Barcode+39+Extended+Text?preview.script=Latn" target="_blank" rel="noopener noreferrer">Libre Barcode 39 Extended Text</a> ·· Google Fonts</span>
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
