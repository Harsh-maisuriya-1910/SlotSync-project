import { api } from "./api.js";

export const studentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAllSlots: builder.query({
      query: () => "/slots",
      providesTags: ["Slot"],
    }),
    createBooking: builder.mutation({
      query: ({ slotId }) => ({
        url: "/bookings",
        method: "POST",
        body: { slotId },
      }),
      invalidatesTags: ["Booking", "Slot", "Analytics", "AuditLog", "Waitlist"],
    }),
    getOwnBookings: builder.query({
      query: () => "/bookings/my-bookings",
      providesTags: ["Booking"],
    }),
    cancelBooking: builder.mutation({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/cancel`,
        method: "PATCH",
      }),
      invalidatesTags: ["Booking", "Slot", "Analytics", "AuditLog", "Waitlist"],
    }),
    joinWaitlist: builder.mutation({
      query: ({ slotId }) => ({
        url: "/waitlist",
        method: "POST",
        body: { slotId },
      }),
      invalidatesTags: ["Waitlist", "Slot", "Analytics", "AuditLog"],
    }),
    getOwnWaitlists: builder.query({
      query: () => "/waitlist/my-waitlist",
      providesTags: ["Waitlist"],
    }),
  }),
});

export const {
  useGetAllSlotsQuery,
  useCreateBookingMutation,
  useGetOwnBookingsQuery,
  useCancelBookingMutation,
  useJoinWaitlistMutation,
  useGetOwnWaitlistsQuery,
} = studentApi;
