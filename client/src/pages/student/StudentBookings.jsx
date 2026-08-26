import { useMemo } from "react";
import { useGetStudentBookingsQuery, useCancelBookingMutation } from "../../api/studentApi.js";
import { Calendar, User, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useSocket } from "../../hooks/useSocket";

export default function StudentBookings() {
  const { data: bookingsData, isLoading, error, refetch } = useGetStudentBookingsQuery();
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const { user } = useSelector((state) => state.auth);

  const bookings = bookingsData?.data || [];
  const slotIds = useMemo(() => bookings.map(b => b.slot?.id).filter(Boolean), [bookings]);

  useSocket("STUDENT", user?.id, slotIds);

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      const response = await cancelBooking(bookingId).unwrap();
      if (response.success) {
        toast.success("Booking cancelled successfully.");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to cancel booking.";
      toast.error(errMsg);
    }
  };

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
        Failed to retrieve bookings history. Please try again.
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">My Bookings</h1>
        <p className="text-slate-500 text-sm">Monitor your counseling appointments and manage cancellations.</p>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-950">No bookings registered</p>
          <p className="text-xs text-slate-500 mt-1">Browse available slots to book your first appointment.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Counsellor
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timing
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => {
                  const start = booking.slot?.startTime ? new Date(booking.slot.startTime) : null;
                  const end = booking.slot?.endTime ? new Date(booking.slot.endTime) : null;

                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-950">Counseling Session</div>
                        <div className="text-xs text-slate-400 font-mono select-all">{booking.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{booking.slot?.counsellor?.name || "Staff Counsellor"}</div>
                        <div className="text-xs text-slate-500">{booking.slot?.counsellor?.email || "counsellor@slotsync.com"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {start && end ? (
                          <>
                            <div className="text-xs font-semibold text-slate-700">
                              {start.toLocaleDateString()}
                            </div>
                            <div className="text-xs text-slate-500">
                              {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                              {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </>
                        ) : (
                          <span className="text-red-500 text-xs font-medium">Slot Data Unavailable</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
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
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={isCancelling}
                            className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            Cancel Appointment
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Locked</span>
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
