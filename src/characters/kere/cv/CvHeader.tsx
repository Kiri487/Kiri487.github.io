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

/** `asDocument`: a CV shown as a document inside XR's review, where the name is just a name, not a way home. */
function CvHeader({ asDocument = false }: { asDocument?: boolean }) {
  const { setSkin } = useSkin();
  const Name = asDocument ? "p" : "h1";
  return (
    <header id={asDocument ? undefined : "top"} className="kere-header">
      <Name className="kere-header__name">
        {asDocument ? (
          CV_NAME
        ) : (
          // The name doubles as the way back to the main (Kiri) site, like a logo linking home.
          <button type="button" className="kere-header__home" onClick={() => setSkin("kiri")} title="Back to Kiri">
            {CV_NAME}
          </button>
        )}
      </Name>
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
