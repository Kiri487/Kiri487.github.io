import { useState, useEffect } from "react";
import { Link, Location, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import KIRI_LOGO from "../assets/KiriLogo.png" 

function GetPath(location: Location): string {
  const pathParts = location.pathname.split("/");

  if (pathParts[1] === "") {
    return "home";
  }
  else {
    return pathParts[1];
  }
}

function Header() {
  const [current, setCurrent] = useState("home");
  const location = useLocation();

  useEffect(() => {
    setCurrent(GetPath(location));
  }, [location]);

  return (
    <AppBar position="fixed" sx={{ backgroundColor: "#6B7484", boxShadow: "none" }}>
      <Toolbar>
        <div className="header-title" style={{fontSize: "1.2rem"}}>
          <img src={KIRI_LOGO} alt="Kiri's logo" className="kiri-logo" style={{width: "2rem", height: "2rem"}}/>
          Kiri487
        </div>
        <div style={{ flexGrow: 1 }}></div>
        <div className="header-options">
          <Link to="/" className={`header-option ${current === "home" ? "active" : ""}`}>
            Home
          </Link>
          <Link to="/about" className={`header-option ${current === "about" ? "active" : ""}`}>
            About
          </Link>
          <Link to="/project" className={`header-option ${current === "project" ? "active" : ""}`}>
            Project
          </Link>
        </div>
      </Toolbar>
    </AppBar>
  );
}

export default Header;