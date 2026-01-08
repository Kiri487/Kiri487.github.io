import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import KIRI_LOGO from "../assets/KiriLogo.png";
import { MdMusicNote, MdMusicOff } from "react-icons/md";
import { LuMenu } from "react-icons/lu";

interface NavbarProps {
  onRefresh: () => void;
  bgmEnabled: boolean;
  toggleBgm: () => void;
  volume: number;
  setVolume: (val: number) => void;
}

const Navbar = ({ onRefresh, bgmEnabled, toggleBgm, volume, setVolume }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
		setIsMenuOpen(false);
    if (location.pathname === "/") {
      onRefresh();
    } else {
      navigate("/");
    }
  };

	const handleMobileClick = (path: string, e?: React.MouseEvent) => {
    setIsMenuOpen(false);
    if (path === "/" && location.pathname === "/") {
      e?.preventDefault();
      onRefresh();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && !bgmEnabled) {
      toggleBgm();
    }
  };

  return (
		<>
			<nav className="navbar">
				<a href="/" onClick={handleLogoClick} className="navbar-logo-container">
					<img src={KIRI_LOGO} alt="Kiri Logo" className="navbar-logo-img" />
					<span className="navbar-title">Kiri487</span>
				</a>
				<div className="navbar-right-section">
					<div className="navbar-links">
							<Link to="/" className={`nav-link ${isActive("/") ? "active" : ""}`}>
								Home
							</Link>
							<Link to="/about" className={`nav-link ${isActive("/about") ? "active" : ""}`}>
								About
							</Link>
							<Link to="/projects" className={`nav-link ${isActive("/projects") ? "active" : ""}`}>
								Projects
							</Link>
							<Link to="/cited" className={`nav-link ${isActive("/cited") ? "active" : ""}`}>
								Cited
							</Link>
					</div>
					<div className="bgm-control-container">
							<button onClick={toggleBgm} className="bgm-button">
								{bgmEnabled ? <MdMusicNote size={30} /> : <MdMusicOff size={30} />}
							</button>
							<div className="volume-slider-wrapper">
								<input 
                  type="range" min="0" max="1" step="0.01" 
                  value={volume} onChange={handleVolumeChange} 
                  className="volume-slider"
                  style={{ backgroundImage: `linear-gradient(to right, white ${volume * 100}%, rgba(255, 255, 255, 0.7) ${volume * 100}%)` }} />
							</div>
					</div>
					<button className="mobile-menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
							<LuMenu size={30} />
						</button>
				</div>
			</nav>
			<div className={`mobile-menu-dropdown ${isMenuOpen ? "open" : ""}`}>
        <Link to="/" className={`mobile-link ${isActive("/") ? "active" : ""}`} onClick={(e) => handleMobileClick("/", e)}>Home</Link>
        <Link to="/about" className={`mobile-link ${isActive("/about") ? "active" : ""}`} onClick={() => handleMobileClick("/about")}>About</Link>
        <Link to="/projects" className={`mobile-link ${isActive("/projects") ? "active" : ""}`} onClick={() => handleMobileClick("/projects")}>Projects</Link>
        <Link to="/cited" className={`mobile-link ${isActive("/cited") ? "active" : ""}`} onClick={() => handleMobileClick("/cited")}>Cited</Link>
      </div>
		</>
  );
};

export default Navbar;