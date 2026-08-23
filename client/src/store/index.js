import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice.js";
import uiReducer from "./uiSlice.js";
import { api } from "../api/api.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});
