import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { LogOut, User, Calendar, BookOpen, Clock, Users, ShieldAlert, Award } from "lucide-react";
import toast from "react-hot-toast";
import { logout } from "../store/authSlice.js";
import { useLogoutMutation } from "../api/authApi.js";
import { SocketProvider } from "../hooks/useSocket.js";

export default function DashboardLayout() {
  const { user, refreshToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutMutation] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logoutMutation(refreshToken).unwrap();
    } catch (err) {
      console.warn("Logout request failed, cleaning local state anyway", err);
    } finally {
      dispatch(logout());
      toast.success("Logged out successfully");
      navigate("/login", { replace: true });
    }
  };

  // Define navigation tabs based on user role
  const getNavLinks = () => {
    if (user?.role === "ADMIN") {
      return [
        { label: "Overview", path: "/admin/dashboard", icon: Calendar },
        { label: "Counsellors", path: "/admin/counsellors", icon: Users },
        { label: "Audit Logs", path: "/admin/audit-logs", icon: Clock },
      ];
    }
    if (user?.role === "COUNSELLOR") {
      return [
        { label: "Overview", path: "/counsellor/dashboard", icon: Calendar },
        { label: "Manage Slots", path: "/counsellor/slots", icon: Clock },
      ];
    }
    if (user?.role === "STUDENT") {
      return [
        { label: "Browse Slots", path: "/student/dashboard", icon: BookOpen },
        { label: "My Bookings", path: "/student/bookings", icon: Calendar },
        { label: "My Waitlists", path: "/student/waitlist", icon: Clock },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-slate-900 tracking-tight">SlotSync</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                {user?.role}
              </span>
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline font-medium">{user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {navLinks.length > 0 && (
          <div className="bg-white border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`inline-flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                        isActive
                          ? "border-primary-600 text-primary-600"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SocketProvider role={user?.role} id={user?.id}>
          <Outlet />
        </SocketProvider>
      </main>
    </div>
  );
}
