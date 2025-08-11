import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Lawns from "@/pages/Lawns";
import Products from "@/pages/Products";
import Applications from "@/pages/Applications";
import Reports from "@/pages/Reports";
import TaskMonitor from "@/pages/TaskMonitor";
import GDD from "@/pages/GDD";
import WaterManagement from "@/pages/WaterManagement";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lawns" element={<Lawns />} />
          <Route path="/products" element={<Products />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin" element={<TaskMonitor />} />
          <Route path="/gdd" element={<GDD />} />
          <Route path="/water" element={<WaterManagement />} />
        </Routes>
      </AppLayout>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
