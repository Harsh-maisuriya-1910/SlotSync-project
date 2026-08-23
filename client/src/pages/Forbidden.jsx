import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function Forbidden() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-600 mb-6 text-sm">
          You do not have the required permissions to view this page.
        </p>
        <Link
          to="/"
          className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors w-full"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
