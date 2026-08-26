import { useMemo } from "react";
import { useGetOwnWaitlistsQuery } from "../../api/studentApi.js";
import { Clock, User, Calendar } from "lucide-react";
import { useSelector } from "react-redux";
import { useSocket } from "../../hooks/useSocket";

export default function StudentWaitlist() {
  const { data: waitlistsData, isLoading, error } = useGetOwnWaitlistsQuery();
  const { user } = useSelector((state) => state.auth);

  const waitlistEntries = waitlistsData?.data || [];
  const slotIds = useMemo(() => waitlistEntries.map(e => e.slot?.id).filter(Boolean), [waitlistEntries]);

  useSocket("STUDENT", user?.id, slotIds);



  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
        Failed to retrieve waitlist details. Please try again.
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">My Waitlists</h1>
        <p className="text-slate-500 text-sm">Track your queue status and check for automatic booking promotions.</p>
      </div>

      {/* Waitlist Feed */}
      {waitlistEntries.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-950">No waitlist entries found</p>
          <p className="text-xs text-slate-500 mt-1">If a session is full, you can join its waitlist from the slots browser.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Session & ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Counsellor
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Queue Position
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Queue Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timestamps
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {waitlistEntries.map((entry) => {
                  const start = entry.slot?.startTime ? new Date(entry.slot.startTime) : null;
                  const end = entry.slot?.endTime ? new Date(entry.slot.endTime) : null;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-950">Waitlist Appointment</div>
                        <div className="text-xs text-slate-600">
                          {start && end ? (
                            <>{start.toLocaleDateString()} ({start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</>
                          ) : (
                            <span className="text-red-500 font-medium">Slot Data Unavailable</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono select-all mt-0.5">{entry.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{entry.slot?.counsellor?.name || "Staff Counsellor"}</div>
                        <div className="text-xs text-slate-500">{entry.slot?.counsellor?.email || "counsellor@slotsync.com"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.status === "WAITING" ? (
                          <div className="inline-flex items-center space-x-1 font-semibold text-slate-900">
                            <span>#{entry.queuePosition}</span>
                            <span className="text-xs text-slate-400 font-normal">(in queue)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                            entry.status === "WAITING"
                              ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                              : entry.status === "PROMOTED"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        <div>Joined: {new Date(entry.createdAt).toLocaleString()}</div>
                        {entry.promotedAt && (
                          <div className="text-green-600 font-semibold mt-0.5">
                            Promoted: {new Date(entry.promotedAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
