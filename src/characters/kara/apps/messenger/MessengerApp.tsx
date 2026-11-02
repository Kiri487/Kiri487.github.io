import { contacts, type Contact } from "../../../../data/portfolio";
import CharacterAvatar from "../../CharacterAvatar";
import { useWindow } from "../../os/context";
import { openGesture } from "../../os/openGesture";
import { chatTitle, type ChatArgs, type ChatPartnerId } from "../chat/conversations";
import { openExternal } from "../common/openExternal";
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
  { name: "Thursday", status: "Uninstalled" },
  { name: "The Printer", status: "Rumored" },
];

/** A row without `onOpen` is a contact nobody can reach. */
function ContactRow({
  presence,
  name,
  status,
  onOpen,
}: {
  presence: Presence | "offline";
  name: string;
  status: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className={`kara-messenger__dot kara-messenger__dot--${presence}`} />
      <span className="kara-messenger__name">{name}</span>
      <span className="kara-messenger__status">({status})</span>
    </>
  );

  return onOpen ? (
    <button type="button" className="kara-messenger__contact" {...openGesture(onOpen)}>
      {content}
    </button>
  ) : (
    <div className="kara-messenger__contact kara-messenger__contact--inert">{content}</div>
  );
}

function MessengerApp() {
  const { openApp } = useWindow();

  const openChat = (partner: ChatPartnerId) => {
    const args: ChatArgs = { partner };
    openApp("chat", { instanceKey: partner, title: chatTitle(partner), args });
  };

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
        <section className="kara-messenger__group">
          <h3 className="kara-messenger__group-title">Online ({contacts.length})</h3>
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              presence={STATUS[contact.id].presence}
              name={contact.label}
              status={STATUS[contact.id].label}
              onOpen={() => openExternal(contact.url)}
            />
          ))}
        </section>
        <section className="kara-messenger__group">
          <h3 className="kara-messenger__group-title">Offline ({OFFLINE_CONTACTS.length})</h3>
          {OFFLINE_CONTACTS.map(({ name, status, partner }) => (
            <ContactRow
              key={name}
              presence="offline"
              name={name}
              status={status}
              onOpen={partner && (() => openChat(partner))}
            />
          ))}
        </section>
      </div>

      <p className="kara-messenger__hint">Double-click a contact to bother them.</p>
    </div>
  );
}

export default MessengerApp;
