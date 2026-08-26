import { useMemo } from "react";
import { useGetAllSlotsQuery, useCreateBookingMutation, useJoinWaitlistMutation } from "../../api/studentApi.js";
import { Calendar, Users, BookOpen, Clock, AlertCircle, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useSocket } from "../../hooks/useSocket";

export default function StudentDashboard() {
  const { data: slotsData, isLoading, error } = useGetAllSlotsQuery();
  const [bookSlot, { isLoading: isBooking }] = useCreateBookingMutation();
  const [joinWaitlist, { isLoading: isWaitlisting }] = useJoinWaitlistMutation();

  const { user } = useSelector((state) => state.auth);
  
  const slots = slotsData?.data || [];
  const slotIds = useMemo(() => slots.map(s => s.id), [slots]);

  useSocket("STUDENT", user?.id, slotIds);

  const handleBook = async (slotId) => {
    try {
      const response = await bookSlot({ slotId }).unwrap();
      if (response.success) {
        toast.success("Booking registered successfully!");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to book session. Overlap or timing constraint violated.";
      toast.error(errMsg);
    }
  };

  const handleWaitlist = async (slotId) => {
    try {
      const response = await joinWaitlist({ slotId }).unwrap();
      if (response.success) {
        toast.success("Successfully joined the session waitlist!");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to join waitlist. Check active waitlist or booking constraints.";
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
        Failed to retrieve session slots. Please refresh page.
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">Available Slots</h1>
        <p className="text-slate-500 text-sm">Browse scheduled slots, book available appointments, or join the queue waitlist.</p>
      </div>

      {/* Slots Feed Grid */}
      {slots.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-950">No counseling sessions scheduled</p>
          <p className="text-xs text-slate-500 mt-1">Counsellors will publish slots here when available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slots.map((slot) => {
            const start = new Date(slot.startTime);
            const end = new Date(slot.endTime);
            const isFull = slot.bookedCount >= slot.capacity;
            const duration = Math.round((end - start) / (1000 * 60));
            const inForbiddenWindow = (start - new Date()) / (1000 * 60) < 30;

            return (
              <div
                key={slot.id}
                className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:border-slate-300 flex flex-col justify-between transition-colors gap-6"
              >
                {/* Session details */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        isFull
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-green-50 text-green-700 border-green-200"
                      }`}
                    >
                      {isFull ? "FULL" : "AVAILABLE"}
                    </span>

                    <span className="text-xs text-slate-500 font-mono">
                      Cap: {slot.bookedCount}/{slot.capacity}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      {start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>({duration} mins)</span>
                    </div>
                  </div>
                </div>

                {/* Actions Button */}
                <div>
                  {isFull ? (
                    <button
                      onClick={() => handleWaitlist(slot.id)}
                      disabled={isWaitlisting || isBooking}
                      className="w-full inline-flex justify-center items-center py-2 px-4 border border-slate-200 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Join Waitlist
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBook(slot.id)}
                      disabled={isBooking || isWaitlisting || inForbiddenWindow}
                      className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {inForbiddenWindow ? "Window Closed" : "Book Session"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
