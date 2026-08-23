import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";

const startServer = async () => {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(
        `Server running on port ${env.PORT} in ${env.NODE_ENV} mode`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();