import auditRepository from "./audit.repository.js";

const logEvent = async (payload, session = null) => {
  return await auditRepository.createAuditLog(payload, session);
};

const getAuditLogs = async (queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.action) {
    filter.action = queryParams.action;
  }
  if (queryParams.entity) {
    filter.entity = queryParams.entity;
  }

  // Sort by createdAt descending by default
  const sort = { createdAt: -1 };

  const logs = await auditRepository.findAuditLogs({
    filter,
    skip,
    limit,
    sort,
  });

  const totalLogs = await auditRepository.countAuditLogs(filter);
  const totalPages = Math.ceil(totalLogs / limit);

  return {
    logs: logs.map((log) => ({
      id: log._id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.user
        ? {
            id: log.user._id,
            name: log.user.name,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
    })),
    pagination: {
      page,
      limit,
      totalLogs,
      totalPages,
    },
  };
};

export default {
  logEvent,
  getAuditLogs,
};
