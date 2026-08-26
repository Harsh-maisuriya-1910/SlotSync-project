import ApiError from "../../utility/ApiError.js";
import BOOKING_STATUS from "../../constants/bookingStatus.js";
import Slot from "../slots/slot.model.js";
import Booking from "../bookings/booking.model.js";
import analyticsRepository from "../analytics/analytics.repository.js";
import auditService from "../audit/audit.service.js";
import AUDIT_ACTIONS from "../../constants/auditActions.js";
import { emitAdminUpdate, emitSlotUpdate } from "../../socket.js";

const getOwnSlots = async (counsellorId) => {
  const slots = await Slot.find({ counsellor: counsellorId }).sort({
    startTime: 1,
  });

  return slots.map((slot) => ({
    id: slot._id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
    status: slot.status,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  }));
};

const getOwnBookings = async (counsellorId) => {
  const slots = await Slot.find({ counsellor: counsellorId });
  const slotIds = slots.map((s) => s._id);

  const bookings = await Booking.find({ slot: { $in: slotIds } })
    .populate("student", "name email")
    .populate("slot");

  return bookings.map((b) => ({
    id: b._id,
    status: b.status,
    createdAt: b.createdAt,
    student: b.student
      ? {
          id: b.student._id,
          name: b.student.name,
          email: b.student.email,
        }
      : null,
    slot: b.slot
      ? {
          id: b.slot._id,
          startTime: b.slot.startTime,
          endTime: b.slot.endTime,
          capacity: b.slot.capacity,
          bookedCount: b.slot.bookedCount,
        }
      : null,
  }));
};

const markBookingOutcome = async (counsellorId, bookingId, status) => {
  const booking = await Booking.findById(bookingId).populate("slot");

  if (!booking) {
    throw new ApiError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }

  // Ownership validation: verify if the slot belongs to this counsellor
  if (!booking.slot || booking.slot.counsellor.toString() !== counsellorId) {
    throw new ApiError(403, "Access forbidden", "ACCESS_FORBIDDEN");
  }

  // Prevent invalid status transitions
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(
      422,
      "Cannot update outcome of a cancelled booking",
      "INVALID_STATUS_TRANSITION",
    );
  }

  if (booking.status !== BOOKING_STATUS.BOOKED) {
    throw new ApiError(
      422,
      "Booking outcome already marked",
      "INVALID_STATUS_TRANSITION",
    );
  }

  booking.status = status;
  await booking.save();

  await auditService.logEvent({
    user: counsellorId,
    action: AUDIT_ACTIONS.OUTCOME_UPDATED,
    entity: "BOOKING",
    entityId: bookingId,
    metadata: { status },
  });

  // Emit live events
  emitAdminUpdate("admin:analytics_update", { action: "outcome_updated" });
  emitSlotUpdate(booking.slot._id, { action: "outcome_updated" });

  return {
    id: booking._id,
    status: booking.status,
    updatedAt: booking.updatedAt,
  };
};

const getCounsellorDashboard = async (counsellorId) => {
  const stats = await analyticsRepository.getCounsellorDashboardStats(
    counsellorId,
  );

  const utilizationPercentage =
    stats.totalCapacity > 0
      ? parseFloat(((stats.totalReserved / stats.totalCapacity) * 100).toFixed(2))
      : 0;

  return {
    totalSlots: stats.totalSlots,
    upcomingSlots: stats.upcomingSlots,
    completedSlots: stats.completedSlots,
    totalReserved: stats.totalReserved,
    totalCapacity: stats.totalCapacity,
    totalBookings: stats.totalBookings,
    attendedCount: stats.attendedCount,
    noShowCount: stats.noShowCount,
    utilizationPercentage,
  };
};

export default {
  getOwnSlots,
  getOwnBookings,
  markBookingOutcome,
  getCounsellorDashboard,
};
