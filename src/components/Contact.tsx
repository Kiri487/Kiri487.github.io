import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { FaXTwitter } from "react-icons/fa6";
import { FiMail } from "react-icons/fi";

function Contact() {
  return (
    <div className="contact">
        <a href="https://github.com/Kiri487" target="_blank" rel="noopener noreferrer" aria-label="Kiri's GitHub"><FaGithub size={30} /></a>
        <a href="https://www.linkedin.com/in/yi-xuan-wu/" target="_blank" rel="noopener noreferrer" aria-label="Kiri's Linkedin"><FaLinkedin size={30} /></a>
        <a href="https://x.com/kiri487_xxx" target="_blank" rel="noopener noreferrer" aria-label="Kiri's Twitter(X)"><FaXTwitter size={30} /></a>
        <a href="mailto:kiri48787@gmail.com" aria-label="Kiri's mail"><FiMail size={30} /></a>
    </div>
  );
}

export default Contact;