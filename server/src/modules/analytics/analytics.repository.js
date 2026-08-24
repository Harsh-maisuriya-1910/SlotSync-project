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
        totalSlots: [
          { $count: "count" }
        ],
        seatUtilization: [
          {
            $group: {
              _id: null,
              capacity: { $sum: "$capacity" },
              bookedCount: { $sum: "$bookedCount" }
            }
          }
        ],
        bookingsStats: [
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
              _id: null,
              totalBookings: { $sum: 1 },
              confirmedBookings: {
                $sum: {
                  $cond: [
                    { $in: ["$bookings.status", ["BOOKED", "ATTENDED"]] },
                    1,
                    0
                  ]
                }
              },
              bookedCount: {
                $sum: {
                  $cond: [{ $eq: ["$bookings.status", "BOOKED"] }, 1, 0]
                }
              },
              attendedCount: {
                $sum: {
                  $cond: [{ $eq: ["$bookings.status", "ATTENDED"] }, 1, 0]
                }
              },
              noShowCount: {
                $sum: {
                  $cond: [{ $eq: ["$bookings.status", "NO_SHOW"] }, 1, 0]
                }
              },
              cancelledCount: {
                $sum: {
                  $cond: [{ $eq: ["$bookings.status", "CANCELLED"] }, 1, 0]
                }
              },
              totalLeadTimeMinutes: {
                $sum: {
                  $divide: [
                    { $subtract: ["$startTime", "$bookings.createdAt"] },
                    1000 * 60
                  ]
                }
              }
            }
          }
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
              leadTimeMinutes: {
                $divide: [
                  { $subtract: ["$startTime", "$bookings.createdAt"] },
                  1000 * 60
                ]
              }
            }
          },
          {
            $bucket: {
              groupBy: "$leadTimeMinutes",
              boundaries: [0, 60, 240, 1440, Infinity],
              default: "Other",
              output: {
                count: { $sum: 1 }
              }
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
    },
    {
      $project: {
        totalSlots: { $ifNull: [{ $arrayElemAt: ["$totalSlots.count", 0] }, 0] },
        totalBookings: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] },
        totalConfirmedBookings: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.confirmedBookings", 0] }, 0] },
        seatUtilization: {
          capacity: { $ifNull: [{ $arrayElemAt: ["$seatUtilization.capacity", 0] }, 0] },
          bookedCount: { $ifNull: [{ $arrayElemAt: ["$seatUtilization.bookedCount", 0] }, 0] },
          utilizationPercentage: {
            $cond: {
              if: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$seatUtilization.capacity", 0] }, 0] }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $ifNull: [{ $arrayElemAt: ["$seatUtilization.bookedCount", 0] }, 0] },
                      { $ifNull: [{ $arrayElemAt: ["$seatUtilization.capacity", 0] }, 0] }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        },
        bookingStatusDistribution: {
          BOOKED: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.bookedCount", 0] }, 0] },
          CANCELLED: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.cancelledCount", 0] }, 0] },
          ATTENDED: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.attendedCount", 0] }, 0] },
          NO_SHOW: { $ifNull: [{ $arrayElemAt: ["$bookingsStats.noShowCount", 0] }, 0] }
        },
        noShowPercentage: {
          $cond: {
            if: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }, 0] },
            then: {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: [{ $arrayElemAt: ["$bookingsStats.noShowCount", 0] }, 0] },
                    { $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }
                  ]
                },
                100
              ]
            },
            else: 0
          }
        },
        cancellationPercentage: {
          $cond: {
            if: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }, 0] },
            then: {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: [{ $arrayElemAt: ["$bookingsStats.cancelledCount", 0] }, 0] },
                    { $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }
                  ]
                },
                100
              ]
            },
            else: 0
          }
        },
        averageLeadTimeMinutes: {
          $cond: {
            if: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }, 0] },
            then: {
              $divide: [
                { $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalLeadTimeMinutes", 0] }, 0] },
                { $ifNull: [{ $arrayElemAt: ["$bookingsStats.totalBookings", 0] }, 0] }
              ]
            },
            else: 0
          }
        },
        leadTimeBuckets: "$leadTimeBuckets",
        busiestSlots: "$busiestSlots",
        last14DaysTrend: "$last14DaysTrend"
      }
    }
  ]);

  const output = results[0] || {};

  const bucketLabels = {
    0: "0-59",
    60: "60-239",
    240: "240-1439",
    1440: "1440+"
  };

  const formattedBuckets = [
    { bucket: "0-59", count: 0 },
    { bucket: "60-239", count: 0 },
    { bucket: "240-1439", count: 0 },
    { bucket: "1440+", count: 0 }
  ];

  if (output.leadTimeBuckets) {
    output.leadTimeBuckets.forEach((b) => {
      const label = bucketLabels[b._id] || "Other";
      const bucketObj = formattedBuckets.find((fb) => fb.bucket === label);
      if (bucketObj) {
        bucketObj.count = b.count;
      }
    });
  }

  const trend = output.last14DaysTrend ? output.last14DaysTrend.map((item) => ({
    date: item._id,
    count: item.count
  })) : [];

  const seatUtil = (Array.isArray(output.seatUtilization) ? output.seatUtilization[0] : output.seatUtilization) || {};
  const statusDist = (Array.isArray(output.bookingStatusDistribution) ? output.bookingStatusDistribution[0] : output.bookingStatusDistribution) || {};

  return {
    totalSlots: output.totalSlots || 0,
    totalBookings: output.totalBookings || 0,
    totalConfirmedBookings: output.totalConfirmedBookings || 0,
    seatUtilization: {
      capacity: seatUtil.capacity || 0,
      bookedCount: seatUtil.bookedCount || 0,
      utilizationPercentage: parseFloat((seatUtil.utilizationPercentage || 0).toFixed(2))
    },
    bookingStatusDistribution: statusDist.BOOKED !== undefined ? statusDist : { BOOKED: 0, CANCELLED: 0, ATTENDED: 0, NO_SHOW: 0 },
    noShowPercentage: parseFloat((output.noShowPercentage || 0).toFixed(2)),
    cancellationPercentage: parseFloat((output.cancellationPercentage || 0).toFixed(2)),
    averageLeadTimeMinutes: parseFloat((output.averageLeadTimeMinutes || 0).toFixed(2)),
    leadTimeBuckets: formattedBuckets,
    busiestSlots: output.busiestSlots || [],
    fourteenDayTrend: trend,
    last14DaysTrend: trend
  };
};

export default {
  getAdminDashboardStats,
  getCounsellorDashboardStats,
  getCounsellorAnalyticsPipeline,
};
