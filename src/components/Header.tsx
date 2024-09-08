import { useState, useEffect } from "react";
import { Link, Location, useLocation } from "react-router-dom";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';

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
        <div style={{fontSize: "1.2rem"}}>
          Kiri487
        </div>
        <div style={{ flexGrow: 1 }}></div>
        <Link to="/" className={`header-options ${current === "home" ? "active" : ""}`}>
          Home
        </Link>
        <Link to="/about" className={`header-options ${current === "about" ? "active" : ""}`}>
          About
        </Link>
        <Link to="/project" className={`header-options ${current === "project" ? "active" : ""}`}>
          Project
        </Link>
      </Toolbar>
    </AppBar>
  );
}

export default Header;