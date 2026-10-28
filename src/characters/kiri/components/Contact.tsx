import type { IconType } from 'react-icons';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";
// Aliased: this file's component is also called Contact.
import { contacts, type Contact as ContactData } from "../../../data/portfolio/contacts";

const ICONS: Record<ContactData["id"], IconType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  mail: FiMail,
};

function Contact() {
  return (
    <div className="contact">
      {contacts.map((c) => {
        const Icon = ICONS[c.id];
        return (
          <a
            key={c.id}
            href={c.url}
            target={c.id === "mail" ? undefined : "_blank"}
            rel={c.id === "mail" ? undefined : "noopener noreferrer"}
            aria-label={c.label}
          >
            <Icon size={30} />
          </a>
        );
      })}
    </div>
  );
}

export default Contact;
