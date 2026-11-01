import { contacts, type Contact } from "../../../../data/portfolio";
import CharacterAvatar from "../../CharacterAvatar";
import { useWindow } from "../../os/context";
import { chatTitle, type ChatArgs, type ChatPartnerId } from "../chat/conversations";
import "./messenger.css";

type Presence = "online" | "busy" | "away";

/** Fixed on purpose: the joke is who each service is, so it shouldn't change between visits. */
const STATUS: Record<Contact["id"], { label: string; presence: Presence }> = {
  github: { label: "Online", presence: "online" },
  x: { label: "Online", presence: "online" },
  mail: { label: "Away", presence: "away" },
  linkedin: { label: "Busy", presence: "busy" },
};

/** Kara's other sides, plus things that went missing elsewhere on this computer. Only the characters open a chat. */
const OFFLINE_CONTACTS: { name: string; status: string; partner?: ChatPartnerId }[] = [
  { name: "Kiri", status: "Asleep. Allegedly.", partner: "kiri" },
  { name: "Kuru", status: "Chill", partner: "kuru" },
  { name: "Kere", status: "Out of office", partner: "kere" },
  { name: "Koro", status: "Won't read it yet :P", partner: "koro" },
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

function OfflineGroup() {
  const { openApp } = useWindow();

  const openChat = (partner: ChatPartnerId) => {
    const args: ChatArgs = { partner };
    openApp("chat", { title: chatTitle(partner), args });
  };

  return (
    <section className="kara-messenger__group">
      <h3 className="kara-messenger__group-title">Offline ({OFFLINE_CONTACTS.length})</h3>
      {OFFLINE_CONTACTS.map(({ name, status, partner }) => {
        const content = (
          <>
            <span className="kara-messenger__dot kara-messenger__dot--offline" />
            <span className="kara-messenger__name">{name}</span>
            <span className="kara-messenger__status">({status})</span>
          </>
        );
        return partner ? (
          <button
            key={name}
            type="button"
            className="kara-messenger__contact"
            onDoubleClick={() => openChat(partner)}
            onKeyDown={(event) => {
              if (event.key === "Enter") openChat(partner);
            }}
          >
            {content}
          </button>
        ) : (
          <div key={name} className="kara-messenger__contact kara-messenger__contact--inert">
            {content}
          </div>
        );
      })}
    </section>
  );
}

function MessengerApp() {
  return (
    <div className="kara-messenger">
      <div className="kara-messenger__me">
        <CharacterAvatar character="kara" size={42} />
        <span>
          <span className="kara-messenger__my-name">Kara</span>
          <span className="kara-messenger__mood">is thinking about a door</span>
        </span>
      </div>

      <div className="kara-messenger__list">
        <ContactGroup title="Online" members={contacts} />
        <OfflineGroup />
      </div>

      <p className="kara-messenger__hint">Double-click a contact to bother them.</p>
    </div>
  );
}

export default MessengerApp;
