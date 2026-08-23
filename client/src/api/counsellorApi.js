import { api } from "./api.js";

export const counsellorApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createSlot: builder.mutation({
      query: (payload) => ({
        url: "/slots",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["Slot", "Analytics", "AuditLog"],
    }),
    getOwnSlots: builder.query({
      query: () => "/counsellor/slots",
      providesTags: ["Slot"],
    }),
    getOwnBookings: builder.query({
      query: () => "/counsellor/bookings",
      providesTags: ["Booking"],
    }),
    markBookingOutcome: builder.mutation({
      query: ({ bookingId, status }) => ({
        url: `/counsellor/bookings/${bookingId}/outcome`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Booking", "Analytics", "AuditLog"],
    }),
    getCounsellorDashboard: builder.query({
      query: () => "/counsellor/dashboard",
      providesTags: ["Analytics"],
    }),
  }),
});

export const {
  useCreateSlotMutation,
  useGetOwnSlotsQuery,
  useGetOwnBookingsQuery,
  useMarkBookingOutcomeMutation,
  useGetCounsellorDashboardQuery,
} = counsellorApi;
