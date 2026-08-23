import mongoose from "mongoose";
import User from "../users/user.model.js";
import Slot from "../slots/slot.model.js";
import Booking from "../bookings/booking.model.js";
import ROLES from "../../constants/roles.js";

const getAdminDashboardStats = async () => {
  // 1. User stats
  const userStats = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  let totalStudents = 0;
  let totalCounsellors = 0;
  let totalUsers = 0;

  userStats.forEach((stat) => {
    if (stat._id === ROLES.STUDENT) totalStudents = stat.count;
    if (stat._id === ROLES.COUNSELLOR) totalCounsellors = stat.count;
    totalUsers += stat.count;
  });

  // 2. Slot & Booking & Utilization stats
  const slotStats = await Slot.aggregate([
    {
      $facet: {
        total: [{ $count: "count" }],
        available: [
          {
            $match: {
              $expr: { $lt: ["$bookedCount", "$capacity"] },
            },
          },
          { $count: "count" },
        ],
        fullyBooked: [
          {
            $match: {
              $expr: { $gte: ["$bookedCount", "$capacity"] },
            },
          },
          { $count: "count" },
        ],
        utilization: [
          {
            $group: {
              _id: null,
              totalCapacity: { $sum: "$capacity" },
              totalReserved: { $sum: "$bookedCount" },
            },
          },
        ],
      },
    },
  ]);

  const totalSlots = slotStats[0].total[0]?.count || 0;
  const availableSlots = slotStats[0].available[0]?.count || 0;
  const fullyBookedSlots = slotStats[0].fullyBooked[0]?.count || 0;
  const totalCapacity = slotStats[0].utilization[0]?.totalCapacity || 0;
  const totalReservedSeats = slotStats[0].utilization[0]?.totalReserved || 0;

  const bookingStats = await Booking.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  let totalBookings = 0;
  let cancelledBookings = 0;
  let attendedBookings = 0;
  let noShowBookings = 0;

  bookingStats.forEach((stat) => {
    if (stat._id === "CANCELLED") cancelledBookings = stat.count;
    if (stat._id === "ATTENDED") attendedBookings = stat.count;
    if (stat._id === "NO_SHOW") noShowBookings = stat.count;
    totalBookings += stat.count;
  });

  return {
    users: {
      totalStudents,
      totalCounsellors,
      totalUsers,
    },
    slots: {
      totalSlots,
      availableSlots,
      fullyBookedSlots,
    },
    bookings: {
      totalBookings,
      cancelledBookings,
      attendedBookings,
      noShowBookings,
    },
    utilization: {
      totalCapacity,
      totalReservedSeats,
    },
  };
};

const getCounsellorDashboardStats = async (counsellorId) => {
  const now = new Date();
  const counsellorObjId = new mongoose.Types.ObjectId(counsellorId);

  // 1. Slot stats
  const slotStats = await Slot.aggregate([
    {
      $match: { counsellor: counsellorObjId },
    },
    {
      $facet: {
        total: [{ $count: "count" }],
        upcoming: [
          { $match: { startTime: { $gt: now } } },
          { $count: "count" },
        ],
        completed: [
          { $match: { endTime: { $lte: now } } },
          { $count: "count" },
        ],
        utilization: [
          {
            $group: {
              _id: null,
              totalCapacity: { $sum: "$capacity" },
              totalReserved: { $sum: "$bookedCount" },
            },
          },
        ],
      },
    },
  ]);

  const totalSlots = slotStats[0].total[0]?.count || 0;
  const upcomingSlots = slotStats[0].upcoming[0]?.count || 0;
  const completedSlots = slotStats[0].completed[0]?.count || 0;
  const totalCapacity = slotStats[0].utilization[0]?.totalCapacity || 0;
  const totalReserved = slotStats[0].utilization[0]?.totalReserved || 0;

  // 2. Bookings stats
  const bookingStats = await Booking.aggregate([
    {
      $lookup: {
        from: "slots",
        localField: "slot",
        foreignField: "_id",
        as: "slotDetails",
      },
    },
    {
      $unwind: "$slotDetails",
    },
    {
      $match: { "slotDetails.counsellor": counsellorObjId },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  let totalBookings = 0;
  let attendedCount = 0;
  let noShowCount = 0;

  bookingStats.forEach((stat) => {
    if (stat._id === "ATTENDED") attendedCount = stat.count;
    if (stat._id === "NO_SHOW") noShowCount = stat.count;
    totalBookings += stat.count;
  });

  return {
    totalSlots,
    upcomingSlots,
    completedSlots,
    totalCapacity,
    totalReserved,
    totalBookings,
    attendedCount,
    noShowCount,
  };
};

export default {
  getAdminDashboardStats,
  getCounsellorDashboardStats,
};
