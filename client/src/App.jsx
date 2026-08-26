import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import { Suspense, lazy } from "react";
import { store } from "./store/index.js";
import { useSelector } from "react-redux";

// Layouts & Guard
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

// Auth Pages (always eagerly loaded — lightweight)
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import Forbidden from "./pages/Forbidden.jsx";
import NotFound from "./pages/NotFound.jsx";

// Admin Pages (lazy loaded)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminCounsellors = lazy(() => import("./pages/admin/AdminCounsellors.jsx"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs.jsx"));

// Counsellor Pages (lazy loaded)
const CounsellorDashboard = lazy(() => import("./pages/counsellor/CounsellorDashboard.jsx"));
const CounsellorSlots = lazy(() => import("./pages/counsellor/CounsellorSlots.jsx"));

// Student Pages (lazy loaded)
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard.jsx"));
const StudentBookings = lazy(() => import("./pages/student/StudentBookings.jsx"));
const StudentWaitlist = lazy(() => import("./pages/student/StudentWaitlist.jsx"));

// Shared loading fallback
function PageLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
}

// Root Redirect component to handle root "/" landing routing
function RootRedirect() {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user?.role === "COUNSELLOR") {
    return <Navigate to="/counsellor/dashboard" replace />;
  }

  return <Navigate to="/student/dashboard" replace />;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forbidden" element={<Forbidden />} />

            {/* Root Redirect handling */}
            <Route path="/" element={<RootRedirect />} />

            {/* Role Protected Dashboard Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                {/* Admin Panel */}
                <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/counsellors" element={<AdminCounsellors />} />
                  <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                </Route>

                {/* Counsellor Panel */}
                <Route element={<ProtectedRoute allowedRoles={["COUNSELLOR"]} />}>
                  <Route path="/counsellor/dashboard" element={<CounsellorDashboard />} />
                  <Route path="/counsellor/slots" element={<CounsellorSlots />} />
                </Route>

                {/* Student Panel */}
                <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
                  <Route path="/student/dashboard" element={<StudentDashboard />} />
                  <Route path="/student/bookings" element={<StudentBookings />} />
                  <Route path="/student/waitlist" element={<StudentWaitlist />} />
                </Route>
              </Route>
            </Route>

            {/* Page Not Found fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </Provider>
  );
}
