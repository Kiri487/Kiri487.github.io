import type { IconType } from "react-icons";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";
import { contacts } from "../../../data/contacts";

const contactIcons: Record<string, IconType> = {
  github: FaGithub,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  mail: FiMail,
};

function ContactContent() {
  return (
    <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
      {contacts.map((c) => {
        const Icon = contactIcons[c.id];
        return (
          <a
            key={c.id}
            href={c.url}
            className="kuru-sticker"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c.label}
            style={{ gap: "0.5rem", width: "auto", paddingInline: "1rem" }}
          >
            {Icon && <Icon />}
            <span style={{ fontFamily: "'Permanent Marker', cursive", fontSize: "0.85rem" }}>
              {c.label}
            </span>
          </a>
        );
      })}
    </div>
  );
}

export default ContactContent;
