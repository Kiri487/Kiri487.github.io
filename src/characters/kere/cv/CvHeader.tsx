import type { IconType } from "react-icons";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";
import { contacts } from "../../../data/portfolio";
import { CONTACT_IDS, CV_NAME, displayUrl } from "./layout";

const ICONS: Record<string, IconType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  mail: FiMail,
};

const shown = CONTACT_IDS.map((id) => contacts.find((c) => c.id === id)).filter((c) => c !== undefined);

function CvHeader() {
  return (
    <header id="top" className="kere-header">
      <h1 className="kere-header__name">{CV_NAME}</h1>
      <ul className="kere-header__contacts">
        {shown.map((c) => {
          const Icon = ICONS[c.id];
          const external = c.id !== "mail";
          return (
            <li key={c.id}>
              <Icon className="kere-header__icon" aria-hidden="true" />
              <a
                href={c.url}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                aria-label={c.label}
              >
                {displayUrl(c.url)}
              </a>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

export default CvHeader;
