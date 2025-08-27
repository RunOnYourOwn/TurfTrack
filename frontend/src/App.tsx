import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Toaster } from "@/components/ui/sonner";

// Lazy load page components for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Lawns = lazy(() => import("@/pages/Lawns"));
const Products = lazy(() => import("@/pages/Products"));
const Applications = lazy(() => import("@/pages/Applications"));
const Reports = lazy(() => import("@/pages/Reports"));
const TaskMonitor = lazy(() => import("@/pages/TaskMonitor"));
const GDD = lazy(() => import("@/pages/GDD"));
const WaterManagement = lazy(() => import("@/pages/WaterManagement"));
const MowerMaintenance = lazy(() => import("@/pages/Mowers"));

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lawns" element={<Lawns />} />
            <Route path="/products" element={<Products />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<TaskMonitor />} />
            <Route path="/gdd" element={<GDD />} />
            <Route path="/water" element={<WaterManagement />} />
            <Route path="/mowers" element={<MowerMaintenance />} />
          </Routes>
        </Suspense>
      </AppLayout>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
