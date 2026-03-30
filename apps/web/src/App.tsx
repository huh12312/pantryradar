import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PantryPage from "./pages/PantryPage";
import FridgePage from "./pages/FridgePage";
import FreezerPage from "./pages/FreezerPage";
import AddItemPage from "./pages/AddItemPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pantry" element={<PantryPage />} />
      <Route path="/fridge" element={<FridgePage />} />
      <Route path="/freezer" element={<FreezerPage />} />
      <Route path="/add" element={<AddItemPage />} />
      <Route path="/" element={<LoginPage />} />
    </Routes>
  );
}

export default App;
