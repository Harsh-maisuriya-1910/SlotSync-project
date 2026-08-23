import { api } from "./api.js";

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createCounsellor: builder.mutation({
      query: (payload) => ({
        url: "/users/counsellors",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["User", "AuditLog"],
    }),
    getAuditLogs: builder.query({
      query: (params) => ({
        url: "/admin/audit-logs",
        method: "GET",
        params,
      }),
      providesTags: ["AuditLog"],
    }),
    getAnalytics: builder.query({
      query: () => "/analytics",
      providesTags: ["Analytics"],
    }),
  }),
});

export const {
  useCreateCounsellorMutation,
  useGetAuditLogsQuery,
  useGetAnalyticsQuery,
} = adminApi;
