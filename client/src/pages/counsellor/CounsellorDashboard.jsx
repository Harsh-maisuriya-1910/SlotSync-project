import { useGetCounsellorDashboardQuery, useGetOwnBookingsQuery, useMarkBookingOutcomeMutation } from "../../api/counsellorApi.js";
import { Calendar, CheckCircle2, XCircle, Users, Percent, UserCheck, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export default function CounsellorDashboard() {
  const { data: dashboardData, isLoading: isDashLoading, error: dashError } = useGetCounsellorDashboardQuery();
  const { data: bookingsData, isLoading: isBookingsLoading, error: bookingsError, refetch } = useGetOwnBookingsQuery();
  const [markOutcome, { isLoading: isUpdating }] = useMarkBookingOutcomeMutation();

  const handleOutcome = async (bookingId, status) => {
    try {
      const response = await markOutcome({ bookingId, status }).unwrap();
      if (response.success) {
        toast.success(`Booking successfully marked as ${status.replace("_", " ").toLowerCase()}`);
        refetch();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to update booking outcome.";
      toast.error(errMsg);
    }
  };

  const isPageLoading = isDashLoading || isBookingsLoading;
  const pageError = dashError || bookingsError;

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
        Failed to load counsellor dashboard. Please try again.
      </div>
    );
  }

  const stats = dashboardData?.data || {};
  const bookings = bookingsData?.data || [];

  // Calculate utilization percentage
  const utilizationRate = stats.totalCapacity > 0
    ? Math.round((stats.totalReserved / stats.totalCapacity) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Counsellor Dashboard</h1>
        <p className="text-slate-500 text-sm">Track your scheduled slots, registered student bookings, and session outcomes.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Slots */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Slots</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.totalSlots || 0}</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">{stats.upcomingSlots || 0}</span> Upcoming
            </div>
            <div>
              <span className="font-semibold text-slate-500">{stats.completedSlots || 0}</span> Completed
            </div>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bookings</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.totalBookings || 0}</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-green-600">{stats.attendedCount || 0}</span> Attended
            </div>
            <div>
              <span className="font-semibold text-red-500">{stats.noShowCount || 0}</span> No Show
            </div>
          </div>
        </div>

        {/* Utilization Rate */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Seat Utilization</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{utilizationRate}%</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">{stats.totalReserved || 0}</span> Booked
            </div>
            <div>
              <span className="font-semibold text-slate-900">{stats.totalCapacity || 0}</span> Total Capacity
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Attendance Rate</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">
                {stats.totalBookings > 0
                  ? Math.round((stats.attendedCount / (stats.attendedCount + stats.noShowCount || 1)) * 100)
                  : 0}
                %
              </h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Based on finished student sessions.
          </div>
        </div>
      </div>

      {/* Bookings Action Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-base font-semibold text-slate-900">Student Booking Outcomes</h2>
          <div className="text-xs text-slate-500">
            Total active bookings: <span className="font-semibold text-slate-900">{bookings.length}</span>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-900">No student bookings found</p>
            <p className="text-xs text-slate-400 mt-1">Bookings on your slots will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timing
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Booking Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{booking.student?.name}</div>
                      <div className="text-xs text-slate-500">{booking.student?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-700">
                        {new Date(booking.slot?.startTime).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(booking.slot?.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(booking.slot?.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                          booking.status === "BOOKED"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : booking.status === "ATTENDED"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : booking.status === "NO_SHOW"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {booking.status === "BOOKED" ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleOutcome(booking._id, "ATTENDED")}
                            disabled={isUpdating}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 border border-green-200 rounded text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Attended</span>
                          </button>
                          <button
                            onClick={() => handleOutcome(booking._id, "NO_SHOW")}
                            disabled={isUpdating}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 border border-amber-200 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>No Show</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Outcome locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
