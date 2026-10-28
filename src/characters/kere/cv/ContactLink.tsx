import type { Contact } from "../../../data/portfolio";
import { displayUrl } from "./format";

/** A contact shown as its bare URL; mail opens in place, everything else in a new tab. */
function ContactLink({ contact }: { contact: Contact }) {
  const external = contact.id !== "mail";
  return (
    <a
      href={contact.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={contact.label}
    >
      {displayUrl(contact.url)}
    </a>
  );
}

export default ContactLink;
