import type { IconType } from "react-icons";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";
import {
  educationData,
  workData,
  experienceData,
  skillsData,
} from "../../../data/about";
import { contacts } from "../../../data/contacts";

const contactIcons: Record<string, IconType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  mail: FiMail,
};

function AboutContent() {
  const allSkills = skillsData.flatMap((cat) => cat.skills);

  return (
    <div className="kuru-term">
      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; SKILLS</span>
          <span className="kuru-term__line" />
          <span className="kuru-term__meta">[{allSkills.length} loaded]</span>
        </div>
        <div className="kuru-term__tree">
          {skillsData.map((cat, i) => (
            <div key={cat.category} className="kuru-term__branch">
              <span className="kuru-term__prefix">
                {i === skillsData.length - 1 ? "└──" : "├──"}
              </span>
              <span className="kuru-term__label">{cat.category}</span>
              <span className="kuru-term__dots"> ·· </span>
              <span className="kuru-term__items">
                {cat.skills.map((s, j) => (
                  <span key={s.tech}>{j > 0 && " ∙ "}{s.name}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; EDU.LOG</span>
          <span className="kuru-term__line" />
        </div>
        <div className="kuru-term__log">
          {educationData.map((e) => (
            <div key={e.school} className="kuru-term__log-entry">
              <span className="kuru-term__log-time">[{e.period}]</span>
              <span className="kuru-term__log-name">{e.school}</span>
              <span className="kuru-term__log-sep">──</span>
              <span className="kuru-term__log-detail">{e.department}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; WORK.LOG</span>
          <span className="kuru-term__line" />
        </div>
        <div className="kuru-term__log">
          {workData.map((w) => (
            <div key={w.company} className="kuru-term__log-entry">
              <span className="kuru-term__log-time">[{w.period}]</span>
              <span className="kuru-term__log-name">{w.company}</span>
              <span className="kuru-term__log-sep">──</span>
              <span className="kuru-term__log-detail">{w.position}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; HIGHLIGHTS</span>
          <span className="kuru-term__line" />
        </div>
        <div className="kuru-term__tree">
          {experienceData.map((cat) => (
            <div key={cat.category} className="kuru-term__group">
              <div className="kuru-term__group-cat">:: {cat.category}</div>
              {cat.items.map((item, j) => (
                <div key={item} className="kuru-term__group-item">
                  <span className="kuru-term__prefix">
                    {j === cat.items.length - 1 ? "└" : "├"}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="kuru-content-about__contact">
        <div className="kuru-contact-links">
          {contacts.map((c) => {
            const Icon = contactIcons[c.id];
            return (
              <a
                key={c.id}
                href={c.url}
                className="kuru-contact-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={c.label}
              >
                {Icon && <Icon />}
                <span>{c.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AboutContent;
