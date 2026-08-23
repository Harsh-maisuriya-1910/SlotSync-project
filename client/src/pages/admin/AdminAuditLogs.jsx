import { useState } from "react";
import { useGetAuditLogsQuery } from "../../api/adminApi.js";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Layers } from "lucide-react";
import AUDIT_ACTIONS from "../../../../server/src/constants/auditActions.js";

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const limit = 10;

  // Build params
  const params = {
    page,
    limit,
    ...(action && { action }),
    ...(entity && { entity }),
  };

  const { data, isLoading, error, refetch, isFetching } = useGetAuditLogsQuery(params);

  const logsData = data?.data || {};
  const logs = logsData.logs || [];
  const pagination = logsData.pagination || { totalPages: 1, totalLogs: 0 };

  const handleActionChange = (e) => {
    setAction(e.target.value);
    setPage(1); // Reset page to 1
  };

  const handleEntityChange = (e) => {
    setEntity(e.target.value);
    setPage(1); // Reset page to 1
  };

  const handleReset = () => {
    setAction("");
    setEntity("");
    setPage(1);
  };

  const getActionBadgeColor = (act) => {
    switch (act) {
      case "BOOKING_CREATED":
        return "bg-green-50 text-green-700 border-green-200";
      case "BOOKING_CANCELLED":
        return "bg-red-50 text-red-700 border-red-200";
      case "WAITLIST_JOINED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "WAITLIST_PROMOTED":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "SLOT_CREATED":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "OUTCOME_UPDATED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
          <p className="text-slate-500 text-sm">Real-time ledger of bookings, slots creation, outcome updates, and waitlist activities.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={action}
              onChange={handleActionChange}
              className="block w-full max-w-xs pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">All Actions</option>
              {Object.keys(AUDIT_ACTIONS).map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={entity}
              onChange={handleEntityChange}
              className="block w-full max-w-xs pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">All Entities</option>
              <option value="BOOKING">BOOKING</option>
              <option value="SLOT">SLOT</option>
              <option value="WAITLIST">WAITLIST</option>
            </select>
          </div>

          {(action || entity) && (
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-primary-600 hover:text-primary-500"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-900">{logs.length}</span> logs
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-600">
            Failed to retrieve audit log data. Please try again.
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-900">No audit logs matching selection</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the action or entity filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Entity & ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Metadata
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{log.user?.name || "System"}</div>
                        <div className="text-xs text-slate-500">{log.user?.email || "system@slotsync.com"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-700">{log.entity}</div>
                        <div className="text-xs text-slate-400 font-mono select-all">{log.entityId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 max-w-xs overflow-x-auto font-mono max-h-20 scrollbar-thin">
                          {JSON.stringify(log.metadata)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-slate-200 sm:px-6 flex justify-between items-center">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <div className="text-sm text-slate-500">
                  Page <span className="font-medium text-slate-900">{page}</span> of{" "}
                  <span className="font-medium text-slate-900">{pagination.totalPages}</span>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
                  disabled={page === pagination.totalPages}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
