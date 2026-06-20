import { worksData } from "../../../data/works";

function WorksContent() {
  return (
    <div className="kuru-photo-grid">
      {worksData.map((w) => (
        <a
          key={w.url + w.title}
          href={w.url}
          className="kuru-photo"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="kuru-photo__img"
            src={w.thumbnail}
            alt={w.title}
            loading="lazy"
          />
          <span className="kuru-photo__title">{w.title}</span>
        </a>
      ))}
    </div>
  );
}

export default WorksContent;
