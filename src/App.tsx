import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Drawer from "./components/Drawer";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Portfolio from "./pages/Portfolio";

function App() {
  return (
    <Router basename="/">
      <Drawer />
      <div className="App">  
        <div className="routes-container">
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/portfolio" element={<Portfolio />} />
          </Routes>
        </div>
      </div>
      <Footer />
    </Router>
  );
}

export default App;