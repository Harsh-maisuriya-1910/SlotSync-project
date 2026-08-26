import { createSlice } from "@reduxjs/toolkit";

const token = localStorage.getItem("token");
const storedRefreshToken = localStorage.getItem("refreshToken");
let user = null;

try {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    user = JSON.parse(storedUser);
  }
} catch (e) {
  console.error("Failed to parse stored user", e);
  localStorage.removeItem("user");
}

const initialState = {
  token: token || null,
  refreshToken: storedRefreshToken || null,
  user: user || null,
  isAuthenticated: !!token,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { accessToken, refreshToken, user } = action.payload;
      state.token = accessToken;
      state.refreshToken = refreshToken || state.refreshToken;
      state.user = user;
      state.isAuthenticated = true;

      localStorage.setItem("token", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    },
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;

      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
