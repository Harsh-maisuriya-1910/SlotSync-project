import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateSlotMutation, useGetOwnSlotsQuery } from "../../api/counsellorApi.js";
import { Calendar, Plus, Clock, Users, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

const slotSchema = z
  .object({
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      return start >= new Date();
    },
    {
      message: "Start time must be in the future",
      path: ["startTime"],
    }
  );

export default function CounsellorSlots() {
  const [createSlot, { isLoading: isCreating }] = useCreateSlotMutation();
  const { data: slotsData, isLoading: isSlotsLoading, error, refetch } = useGetOwnSlotsQuery();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(slotSchema),
    defaultValues: { startTime: "", endTime: "", capacity: 1 },
  });

  const onSubmit = async (data) => {
    try {
      const response = await createSlot({
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        capacity: data.capacity,
      }).unwrap();

      if (response.success) {
        toast.success("Slot scheduled successfully!");
        reset();
        refetch();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to schedule slot (scheduling overlap detected).";
      toast.error(errMsg);
    }
  };

  const slots = slotsData?.data || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Slots</h1>
        <p className="text-slate-500 text-sm">Schedule new counseling sessions and monitor attendance capacity details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Slot Creation Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-6 shadow-sm h-fit">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <Plus className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900 font-sans">Schedule Slot</h2>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="startTime" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Start Time
              </label>
              <input
                id="startTime"
                type="datetime-local"
                disabled={isCreating}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.startTime
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("startTime")}
              />
              {errors.startTime && <p className="mt-1 text-xs text-red-600">{errors.startTime.message}</p>}
            </div>

            <div>
              <label htmlFor="endTime" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                End Time
              </label>
              <input
                id="endTime"
                type="datetime-local"
                disabled={isCreating}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.endTime
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("endTime")}
              />
              {errors.endTime && <p className="mt-1 text-xs text-red-600">{errors.endTime.message}</p>}
            </div>

            <div>
              <label htmlFor="capacity" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Seat Capacity
              </label>
              <input
                id="capacity"
                type="number"
                disabled={isCreating}
                min="1"
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.capacity
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("capacity")}
              />
              {errors.capacity && <p className="mt-1 text-xs text-red-600">{errors.capacity.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="mt-2 w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? "Scheduling..." : "Schedule Session"}
            </button>
          </form>
        </div>

        {/* Slots List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Your Scheduled Slots</h2>
          </div>

          {isSlotsLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600">
              Failed to load slots. Please refresh the page.
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-md">
              <Calendar className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-900">No scheduled slots</p>
              <p className="text-xs text-slate-500 mt-1">Use the form on the left to schedule your first session.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => {
                const startTime = new Date(slot.startTime);
                const endTime = new Date(slot.endTime);
                const isFull = slot.bookedCount >= slot.capacity;

                return (
                  <div
                    key={slot.id}
                    className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-slate-300 transition-colors bg-white gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-slate-900 font-medium text-sm">
                        <span>{startTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>-</span>
                        <span>{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        <span className="flex items-center">
                          <Users className="w-3.5 h-3.5 mr-1" />
                          Capacity: {slot.bookedCount}/{slot.capacity}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          Duration: {Math.round((endTime - startTime) / (1000 * 60))} mins
                        </span>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          isFull
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {isFull ? "FULL" : "AVAILABLE"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
