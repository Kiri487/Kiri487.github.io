import { contacts, type Contact } from "../../../../data/portfolio";
import { CatMarkIcon } from "../../icons";
import "./messenger.css";

type Presence = "online" | "busy" | "away";

/** Fixed on purpose: the joke is who each service is, so it shouldn't change between visits. */
const STATUS: Record<Contact["id"], { label: string; presence: Presence }> = {
  github: { label: "Online", presence: "online" },
  x: { label: "Online", presence: "online" },
  mail: { label: "Away", presence: "away" },
  linkedin: { label: "Busy", presence: "busy" },
};

/** Kara's other sides, plus things that went missing elsewhere on this computer. Nothing here can be opened. */
const OFFLINE_CONTACTS: { name: string; status: string }[] = [
  { name: "Kiri", status: "Asleep. Allegedly." },
  { name: "Kuru", status: "Appear Offline" },
  { name: "Kere", status: "Out of office" },
  { name: "Koro", status: "Blocked you" },
  { name: "Tuesday", status: "Uninstalled" },
  { name: "The Printer", status: "Rumored" },
];

function openContact({ url }: Contact) {
  // mailto: hands off to the mail app, and would otherwise leave an empty tab behind.
  if (url.startsWith("mailto:")) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

function ContactGroup({ title, members }: { title: string; members: Contact[] }) {
  return (
    <section className="kara-messenger__group">
      <h3 className="kara-messenger__group-title">
        {title} ({members.length})
      </h3>
      {members.map((contact) => {
        const { label, presence } = STATUS[contact.id];
        return (
          <button
            key={contact.id}
            type="button"
            className="kara-messenger__contact"
            onDoubleClick={() => openContact(contact)}
            onKeyDown={(event) => {
              if (event.key === "Enter") openContact(contact);
            }}
          >
            <span className={`kara-messenger__dot kara-messenger__dot--${presence}`} />
            <span className="kara-messenger__name">{contact.label}</span>
            <span className="kara-messenger__status">({label})</span>
          </button>
        );
      })}
    </section>
  );
}

function MessengerApp() {
  return (
    <div className="kara-messenger">
      <div className="kara-messenger__me">
        <span className="kara-messenger__avatar">
          <CatMarkIcon size={30} />
        </span>
        <span>
          <span className="kara-messenger__my-name">Kara</span>
          <span className="kara-messenger__mood">is thinking about a door</span>
        </span>
      </div>

      <div className="kara-messenger__list">
        <ContactGroup title="Online" members={contacts} />
        <section className="kara-messenger__group">
          <h3 className="kara-messenger__group-title">Offline ({OFFLINE_CONTACTS.length})</h3>
          {OFFLINE_CONTACTS.map(({ name, status }) => (
            <div key={name} className="kara-messenger__contact kara-messenger__contact--offline">
              <span className="kara-messenger__dot kara-messenger__dot--offline" />
              <span className="kara-messenger__name">{name}</span>
              <span className="kara-messenger__status">({status})</span>
            </div>
          ))}
        </section>
      </div>

      <p className="kara-messenger__hint">Double-click a contact to bother them.</p>
    </div>
  );
}

export default MessengerApp;
