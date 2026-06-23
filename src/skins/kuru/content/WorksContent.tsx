import { worksData } from "../../../data/works";

const grouped = {
  illustration: worksData.filter((w) => w.type === "illustration"),
  video: worksData.filter((w) => w.type === "video"),
  other: worksData.filter((w) => w.type === "other"),
};

const LABELS: Record<string, string> = {
  illustration: "ILLUST",
  video: "VIDEO",
  other: "OTHER",
};

function WorksContent() {
  return (
    <div className="kuru-term">
      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; gallery /works/</span>
          <span className="kuru-term__line" />
          <span className="kuru-term__meta">[{worksData.length} entries]</span>
        </div>
      </div>

      {Object.entries(grouped).map(
        ([type, items]) =>
          items.length > 0 && (
            <div key={type} className="kuru-term__section">
              <div className="kuru-term__head">
                <span className="kuru-term__prompt">
                  :: {LABELS[type]} [{items.length}]
                </span>
                <span className="kuru-term__line" />
              </div>
              <div className="kuru-file-list">
                {items.map((w, i) => (
                  <a
                    key={w.thumbnail}
                    href={w.url}
                    className="kuru-file kuru-file--link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="kuru-file__idx">
                      #{String(i + 1).padStart(2, "0")}
                    </span>
                    <img
                      className="kuru-file__thumb"
                      src={w.thumbnail}
                      alt={w.title}
                      loading="lazy"
                    />
                    <div className="kuru-file__info">
                      <div className="kuru-file__row1">
                        <span className="kuru-file__title">{w.title}</span>
                        <span className="kuru-file__year">[{w.date}]</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

export default WorksContent;
