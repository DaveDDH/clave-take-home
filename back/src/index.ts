import express from "express";
import cors from "cors";
import chatRouter from "#routes/chat.js";
import processStore from "#stores/processStore.js";

const app = express();
const PORT = process.env.PORT || 5006;

app.use(cors());
app.use(express.json());

app.use("/api", chatRouter);

// Clean up old processes every 30 minutes
setInterval(
  () => {
    processStore.cleanupOldProcesses();
  },
  30 * 60 * 1000
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Process store initialized - tracking async jobs`);
});
