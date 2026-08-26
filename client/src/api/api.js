import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout, setCredentials } from "../store/authSlice.js";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "/api",

  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

let isRefreshing = false;

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401 && !isRefreshing) {
    const refreshToken = localStorage.getItem("refreshToken");

    if (refreshToken) {
      isRefreshing = true;
      try {
        const refreshResult = await baseQuery(
          {
            url: "/auth/refresh",
            method: "POST",
            body: { refreshToken },
          },
          api,
          extraOptions,
        );

        if (refreshResult.data?.data) {
          const { accessToken, refreshToken: newRefreshToken, user } = refreshResult.data.data;
          api.dispatch(setCredentials({ accessToken, refreshToken: newRefreshToken, user }));
          // Retry the original request with the new token
          result = await baseQuery(args, api, extraOptions);
        } else {
          api.dispatch(logout());
        }
      } catch {
        api.dispatch(logout());
      } finally {
        isRefreshing = false;
      }
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Slot", "Booking", "Waitlist", "AuditLog", "Analytics"],
  endpoints: () => ({}),
});
