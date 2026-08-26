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
        _id: null,
        totalStudents: { $sum: { $cond: [{ $eq: ["$role", ROLES.STUDENT] }, 1, 0] } },
        totalCounsellors: { $sum: { $cond: [{ $eq: ["$role", ROLES.COUNSELLOR] }, 1, 0] } },
        totalUsers: { $sum: 1 },
      },
    },
  ]);

  const userResults = userStats[0] || { totalStudents: 0, totalCounsellors: 0, totalUsers: 0 };

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
        _id: null,
        totalBookings: { $sum: 1 },
        cancelledBookings: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
        attendedBookings: { $sum: { $cond: [{ $eq: ["$status", "ATTENDED"] }, 1, 0] } },
        noShowBookings: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } },
      },
    },
  ]);

  const bookingResults = bookingStats[0] || { totalBookings: 0, cancelledBookings: 0, attendedBookings: 0, noShowBookings: 0 };

  return {
    users: {
      totalStudents: userResults.totalStudents,
      totalCounsellors: userResults.totalCounsellors,
      totalUsers: userResults.totalUsers,
    },
    slots: {
      totalSlots,
      availableSlots,
      fullyBookedSlots,
    },
    bookings: {
      totalBookings: bookingResults.totalBookings,
      cancelledBookings: bookingResults.cancelledBookings,
      attendedBookings: bookingResults.attendedBookings,
      noShowBookings: bookingResults.noShowBookings,
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
        _id: null,
        totalBookings: { $sum: 1 },
        attendedCount: { $sum: { $cond: [{ $eq: ["$status", "ATTENDED"] }, 1, 0] } },
        noShowCount: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } },
      },
    },
  ]);

  const bookingResults = bookingStats[0] || { totalBookings: 0, attendedCount: 0, noShowCount: 0 };

  return {
    totalSlots,
    upcomingSlots,
    completedSlots,
    totalCapacity,
    totalReserved,
    totalBookings: bookingResults.totalBookings,
    attendedCount: bookingResults.attendedCount,
    noShowCount: bookingResults.noShowCount,
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
          },
          {
            $project: {
              _id: 0,
              bucket: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$_id", 0] }, then: "0-59" },
                    { case: { $eq: ["$_id", 60] }, then: "60-239" },
                    { case: { $eq: ["$_id", 240] }, then: "240-1439" },
                    { case: { $eq: ["$_id", 1440] }, then: "1440+" }
                  ],
                  default: "Other"
                }
              },
              count: 1
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
        leadTimeBuckets: {
          $map: {
            input: ["0-59", "60-239", "240-1439", "1440+"],
            as: "label",
            in: {
              bucket: "$$label",
              count: {
                $let: {
                  vars: {
                    match: {
                      $filter: {
                        input: "$leadTimeBuckets",
                        as: "b",
                        cond: { $eq: ["$$b.bucket", "$$label"] }
                      }
                    }
                  },
                  in: {
                    $cond: {
                      if: { $gt: [{ $size: "$$match" }, 0] },
                      then: { $arrayElemAt: ["$$match.count", 0] },
                      else: 0
                    }
                  }
                }
              }
            }
          }
        },
        busiestSlots: "$busiestSlots",
        last14DaysTrend: {
          $map: {
            input: "$last14DaysTrend",
            as: "item",
            in: {
              date: "$$item._id",
              count: "$$item.count"
            }
          }
        }
      }
    }
  ]);

  const output = results[0] || {};
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
    leadTimeBuckets: output.leadTimeBuckets || [
      { bucket: "0-59", count: 0 },
      { bucket: "60-239", count: 0 },
      { bucket: "240-1439", count: 0 },
      { bucket: "1440+", count: 0 }
    ],
    busiestSlots: output.busiestSlots || [],
    fourteenDayTrend: output.last14DaysTrend || [],
    last14DaysTrend: output.last14DaysTrend || []
  };
};

export default {
  getAdminDashboardStats,
  getCounsellorDashboardStats,
  getCounsellorAnalyticsPipeline,
};
