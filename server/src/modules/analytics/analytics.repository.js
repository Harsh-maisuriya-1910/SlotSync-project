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

const getCounsellorAnalyticsPipeline = async (counsellorId) => {
  const counsellorObjId = new mongoose.Types.ObjectId(counsellorId);

  const results = await Slot.aggregate([
    {
      $match: { counsellor: counsellorObjId }
    },
    {
      $facet: {
        seatUtilization: [
          {
            $group: {
              _id: null,
              capacity: { $sum: "$capacity" },
              bookedCount: { $sum: "$bookedCount" }
            }
          },
          {
            $project: {
              _id: 0,
              capacity: 1,
              bookedCount: 1,
              utilizationPercentage: {
                $cond: {
                  if: { $gt: ["$capacity", 0] },
                  then: { $multiply: [{ $divide: ["$bookedCount", "$capacity"] }, 100] },
                  else: 0
                }
              }
            }
          }
        ],
        bookingStatusDistribution: [
          {
            $lookup: {
              from: "bookings",
              localField: "_id",
              foreignField: "slot",
              as: "bookings"
            }
          },
          { $unwind: "$bookings" },
          {
            $group: {
              _id: "$bookings.status",
              count: { $sum: 1 }
            }
          }
        ],
        busiestSlots: [
          {
            $project: {
              _id: 1,
              startTime: 1,
              endTime: 1,
              capacity: 1,
              bookedCount: 1
            }
          },
          { $sort: { bookedCount: -1 } },
          { $limit: 5 }
        ],
        leadTimeBuckets: [
          {
            $lookup: {
              from: "bookings",
              localField: "_id",
              foreignField: "slot",
              as: "bookings"
            }
          },
          { $unwind: "$bookings" },
          {
            $project: {
              leadTimeHours: {
                $divide: [
                  { $subtract: ["$startTime", "$bookings.createdAt"] },
                  1000 * 60 * 60
                ]
              }
            }
          },
          {
            $bucket: {
              groupBy: "$leadTimeHours",
              boundaries: [0, 24, 48, Infinity],
              default: "Other",
              output: {
                count: { $sum: 1 }
              }
            }
          }
        ],
        last14DaysTrend: [
          {
            $lookup: {
              from: "bookings",
              localField: "_id",
              foreignField: "slot",
              as: "bookings"
            }
          },
          { $unwind: "$bookings" },
          {
            $match: {
              "bookings.createdAt": {
                $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$bookings.createdAt",
                  timezone: "Asia/Kolkata"
                }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  const output = results[0] || {};

  const dist = { BOOKED: 0, CANCELLED: 0, ATTENDED: 0, NO_SHOW: 0 };
  if (output.bookingStatusDistribution) {
    output.bookingStatusDistribution.forEach((item) => {
      if (item._id) {
        dist[item._id] = item.count;
      }
    });
  }

  const buckets = { "0-24 Hours": 0, "24-48 Hours": 0, "48+ Hours": 0 };
  if (output.leadTimeBuckets) {
    output.leadTimeBuckets.forEach((item) => {
      if (item._id === 0) buckets["0-24 Hours"] = item.count;
      else if (item._id === 24) buckets["24-48 Hours"] = item.count;
      else if (item._id === 48 || item._id === "Other") buckets["48+ Hours"] += item.count;
    });
  }

  const trend = output.last14DaysTrend ? output.last14DaysTrend.map((item) => ({
    date: item._id,
    count: item.count
  })) : [];

  return {
    seatUtilization: output.seatUtilization && output.seatUtilization[0] ? output.seatUtilization[0] : { capacity: 0, bookedCount: 0, utilizationPercentage: 0 },
    bookingStatusDistribution: dist,
    busiestSlots: output.busiestSlots || [],
    leadTimeBuckets: Object.keys(buckets).map((key) => ({ bucket: key, count: buckets[key] })),
    fourteenDayTrend: trend,
    last14DaysTrend: trend
  };
};

export default {
  getAdminDashboardStats,
  getCounsellorDashboardStats,
  getCounsellorAnalyticsPipeline,
};
