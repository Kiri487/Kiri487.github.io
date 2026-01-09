import { FaGithub, FaTelegramPlane } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import { VscMail } from "react-icons/vsc";

function Contact() {
  return (
    <div className="contact">
        <a href="https://github.com/Kiri487" aria-label="Kiri's GitHub"><FaGithub size={30} /></a>
        <a href="https://x.com/kiri487_xxx" aria-label="Kiri's Twitter(X)"><FaXTwitter size={30} /></a>
        <a href="https://telegram.me/kiri_487" aria-label="Kiri's Telegram"><FaTelegramPlane size={30} /></a>
        <a href="mailto:kiri48787@gmail.com" aria-label="Kiri's mail"><VscMail size={30} /></a>
    </div>
  );
}

export default Contact;