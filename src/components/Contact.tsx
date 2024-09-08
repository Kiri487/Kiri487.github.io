import { FaGithub, FaTelegramPlane } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import { VscMail } from "react-icons/vsc";

function Contact() {
  return (
    <div className="contact">
        <a href="https://github.com/Kiri487" style={{marginRight: "1rem"}}><FaGithub size={30} color="white" /></a>
        <a href="https://x.com/Kiri_487" style={{marginRight: "1rem"}}><FaXTwitter size={30} color="white" /></a>
        <a href="https://telegram.me/kiri_487" style={{marginRight: "1rem"}}><FaTelegramPlane size={30} color="white" /></a>
        <a href="mailto:kiri48787@gmail.com"><VscMail size={30} color="white" /></a>
    </div>
  );
}

export default Contact;