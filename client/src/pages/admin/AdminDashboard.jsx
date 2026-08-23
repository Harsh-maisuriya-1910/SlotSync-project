import { useGetAnalyticsQuery } from "../../api/adminApi.js";
import { Users, Clock, Calendar, CheckCircle, XCircle, AlertCircle, BarChart3 } from "lucide-react";

export default function AdminDashboard() {
  const { data, isLoading, error } = useGetAnalyticsQuery();

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
        Failed to load analytics dashboard. Please try again later.
      </div>
    );
  }

  const stats = data?.data || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm">Overview of users, slot bookings, and utilization analytics.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* User Stats Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Users</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.users?.totalUsers || 0}</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">{stats.users?.totalStudents || 0}</span> Students
            </div>
            <div>
              <span className="font-semibold text-slate-900">{stats.users?.totalCounsellors || 0}</span> Counsellors
            </div>
          </div>
        </div>

        {/* Slot Stats Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Slots</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.slots?.totalSlots || 0}</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-green-600">{stats.slots?.availableSlots || 0}</span> Available
            </div>
            <div>
              <span className="font-semibold text-red-600">{stats.slots?.fullyBookedSlots || 0}</span> Full
            </div>
          </div>
        </div>

        {/* Booking Stats Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bookings</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.bookings?.totalBookings || 0}</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-3 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-green-600">{stats.bookings?.attendedBookings || 0}</span> Attended
            </div>
            <div>
              <span className="font-semibold text-slate-900">{stats.bookings?.noShowBookings || 0}</span> No Show
            </div>
            <div>
              <span className="font-semibold text-red-500">{stats.bookings?.cancelledBookings || 0}</span> Cancelled
            </div>
          </div>
        </div>

        {/* Utilization Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Utilization Rate</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.utilization?.utilizationPercentage || 0}%</h3>
            </div>
            <div className="p-2 rounded bg-slate-50 text-slate-600 border border-slate-100">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex space-x-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">{stats.utilization?.totalReservedSeats || 0}</span> Booked Seats
            </div>
            <div>
              <span className="font-semibold text-slate-900">{stats.utilization?.totalCapacity || 0}</span> Total Capacity
            </div>
          </div>
        </div>
      </div>

      {/* Utilization Visual Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Capacity Utilization Progress</h2>
        <div className="w-full bg-slate-100 rounded-full h-3 border border-slate-200 overflow-hidden">
          <div
            className="bg-primary-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.utilization?.utilizationPercentage || 0}%` }}
          ></div>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex justify-between">
          <span>0%</span>
          <span>{stats.utilization?.utilizationPercentage || 0}% Filled</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
