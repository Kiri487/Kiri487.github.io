import { useState, useEffect } from "react";
import { Link, Location, useLocation } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import IconButton from "@mui/material/IconButton";
import KIRI_LOGO from "../assets/KiriLogo.png";

function GetPath(location: Location): string {
  const pathParts = location.pathname.split("/");
  return pathParts[1] === "" ? "home" : pathParts[1];
}

function MyDrawer() {
  const [current, setCurrent] = useState("home");
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setCurrent(GetPath(location));
  }, [location]);

  const toggleDrawer = (open: boolean) => () => {
    setDrawerOpen(open);
  };

  const refreshPage = () => {
    if (current === "home") {
      window.location.reload();
    }
  };

  return (
    <>
      {current !== "home" ? (
        <div className="header"></div>
      ) : (
        <div></div>
      )}
      {!drawerOpen && (
        <IconButton
          onClick={toggleDrawer(true)}
          sx={{
            position: "fixed",
            top: "14px",
            left: "14px",
            zIndex: 1300,
            outline: "none",
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: "transparent",
            },
            "&:active": {
              backgroundColor: "transparent",
            },
            "&:focus": {
              outline: "none",
              backgroundColor: "transparent",
            },
          }}
        >
          <img
            src={KIRI_LOGO}
            alt="Kiri's logo"
            className="kiri-logo"
            style={{ width: "2.5rem", height: "2.5rem"}}
          />
        </IconButton>
      )}

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        sx={{
          zIndex: 1500,
          "& .MuiDrawer-paper": {
            backgroundColor: "#6b7484",
            color: "#ffffff",
            width: 250,
          },
        }}
      >
        <div
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "1.5rem",
            }}
          >
            <img
              src={KIRI_LOGO}
              alt="Kiri's logo"
              style={{ width: "3rem", height: "3rem", marginRight: "0.8rem"}}
            />
            <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Kiri487</span>
          </div>
          <List>
            {current !== "home" ? (
                <Link to="/" className={`drawer-option ${current === "home" ? "active" : ""}`}>
                  <ListItem>Home</ListItem>
                </Link>
              ) : (
                <Link to="/" className={`drawer-option`} onClick={refreshPage}>
                  <ListItem>Refresh</ListItem>
                </Link>
              )}
            <Link to="/about" className={`drawer-option ${current === "about" ? "active" : ""}`}>
              <ListItem>About</ListItem>
            </Link>
            <Link to="/portfolio" className={`drawer-option ${current === "portfolio" ? "active" : ""}`}>
              <ListItem>Portfolio</ListItem>
            </Link>
            <Link to="/cited" className={`drawer-option ${current === "cited" ? "active" : ""}`}>
              <ListItem>Cited</ListItem>
            </Link>
          </List>
        </div>
      </Drawer>
    </>
  );
}

export default MyDrawer;