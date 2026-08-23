import { createSlice } from "@reduxjs/toolkit";

const token = localStorage.getItem("token");
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
  user: user || null,
  isAuthenticated: !!token,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { accessToken, user } = action.payload;
      state.token = accessToken;
      state.user = user;
      state.isAuthenticated = true;

      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;

      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
