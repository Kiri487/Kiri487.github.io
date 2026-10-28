import type { IconType } from "react-icons";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";
import type { Contact } from "../../../data/portfolio";
import { useSkin } from "../../../SkinContext";
import ContactLink from "./ContactLink";
import { CV_CONTACTS, CV_NAME } from "./layout";

const ICONS: Record<Contact["id"], IconType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  mail: FiMail,
};

function CvHeader() {
  const { setSkin } = useSkin();
  return (
    <header id="top" className="kere-header">
      <h1 className="kere-header__name">
        {/* The name doubles as the way back to the main (Kiri) site, like a logo linking home. */}
        <button type="button" className="kere-header__home" onClick={() => setSkin("kiri")} title="Back to Kiri">
          {CV_NAME}
        </button>
      </h1>
      <ul className="kere-header__contacts">
        {CV_CONTACTS.map((c) => {
          const Icon = ICONS[c.id];
          return (
            <li key={c.id}>
              <Icon className="kere-header__icon" aria-hidden="true" />
              <ContactLink contact={c} />
            </li>
          );
        })}
      </ul>
    </header>
  );
}

export default CvHeader;
