import {
  educationData,
  workData,
  experienceData,
  skillsData,
} from "../../../data/about";

function AboutContent() {
  const allSkills = skillsData.flatMap((cat) => cat.skills);

  return (
    <div className="kuru-content-about__layout">
      <div>
        <h3 className="kuru-content__subtitle">SKILLS</h3>
        <div className="kuru-skills">
          {allSkills.map((s) => (
            <span key={s.tech} className="kuru-skill-tag">
              {s.name}
            </span>
          ))}
        </div>

        <h3 className="kuru-content__subtitle">HIGHLIGHTS</h3>
        {experienceData.map((cat) => (
          <div key={cat.category}>
            <p className="kuru-exp__cat">{cat.category}</p>
            <ul className="kuru-exp__list">
              {cat.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <h3 className="kuru-content__subtitle">EDUCATION</h3>
        <div className="kuru-notes">
          {educationData.map((e) => (
            <div key={e.school} className="kuru-note">
              <p className="kuru-note__title">{e.school}</p>
              <p className="kuru-note__sub">{e.department}</p>
              <p className="kuru-note__period">{e.period}</p>
            </div>
          ))}
        </div>

        <h3 className="kuru-content__subtitle" style={{ marginTop: "1.2rem" }}>
          WORK
        </h3>
        <div className="kuru-notes">
          {workData.map((w) => (
            <div key={w.company} className="kuru-note kuru-note--blue">
              <p className="kuru-note__title">{w.company}</p>
              <p className="kuru-note__sub">{w.position}</p>
              <p className="kuru-note__period">{w.period}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AboutContent;
