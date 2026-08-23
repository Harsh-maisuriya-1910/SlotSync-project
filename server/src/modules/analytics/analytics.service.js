import analyticsRepository from "./analytics.repository.js";

const getAdminAnalytics = async () => {
  const stats = await analyticsRepository.getAdminDashboardStats();

  const totalCapacity = stats.utilization.totalCapacity;
  const totalReservedSeats = stats.utilization.totalReservedSeats;
  const utilizationPercentage =
    totalCapacity > 0
      ? parseFloat(((totalReservedSeats / totalCapacity) * 100).toFixed(2))
      : 0;

  return {
    users: stats.users,
    slots: stats.slots,
    bookings: stats.bookings,
    utilization: {
      totalCapacity,
      totalReservedSeats,
      utilizationPercentage,
    },
  };
};

export default {
  getAdminAnalytics,
};
