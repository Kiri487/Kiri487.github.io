import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Drawer from "./components/Drawer";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Portfolio from "./pages/Portfolio";
import Cited from "./pages/Cited";

function App() {
  return (
    <HelmetProvider>
      <Router basename="/">
        <Drawer />
        <div className="App">  
          <div className="routes-container">
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/cited" element={<Cited />} />
            </Routes>
          </div>
        </div>
        <Footer />
      </Router>
    </HelmetProvider>
  );
}

export default App;