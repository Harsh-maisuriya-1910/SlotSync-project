import { api } from "./api.js";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (payload) => ({
        url: "/auth/register",
        method: "POST",
        body: payload,
      }),
    }),
    login: builder.mutation({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    refreshToken: builder.mutation({
      query: (refreshToken) => ({
        url: "/auth/refresh",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    logout: builder.mutation({
      query: (refreshToken) => ({
        url: "/auth/logout",
        method: "POST",
        body: refreshToken ? { refreshToken } : {},
      }),
    }),
    getMe: builder.query({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useLazyGetMeQuery,
  useGetMeQuery,
} = authApi;
