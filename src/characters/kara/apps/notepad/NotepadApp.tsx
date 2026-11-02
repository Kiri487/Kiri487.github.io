import { useState } from "react";
import { useWindow } from "../../os/context";
import MessageBox from "../common/MessageBox";
import { ASDF_LETTER, type NotepadArgs } from "./documents";
import "./notepad.css";

/** Read-only, and every menu is a dead end. */
const MENUS: { label: string; message: string }[] = [
  { label: "File", message: "This letter has already been sent." },
  { label: "Edit", message: "Kara's words are final." },
  { label: "Format", message: "It is already very formal." },
  { label: "View", message: "You're looking at it." },
  { label: "Help", message: "Please direct all complaints to the burger." },
];

function NotepadApp() {
  const { args } = useWindow();
  const [message, setMessage] = useState<string | null>(null);
  const text = (args as NotepadArgs | undefined)?.text ?? ASDF_LETTER;

  return (
    <div className="kara-notepad">
      <div className="kara-notepad__menu-bar">
        {MENUS.map((menu) => (
          <button key={menu.label} type="button" className="kara-notepad__menu" onClick={() => setMessage(menu.message)}>
            {menu.label}
          </button>
        ))}
      </div>
      <pre className="kara-notepad__text">{text}</pre>
      {message && <MessageBox title="Notepad" message={message} onClose={() => setMessage(null)} />}
    </div>
  );
}

export default NotepadApp;
