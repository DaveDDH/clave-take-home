import express from "express";
import cors from "cors";
import chatRouter from "#routes/chat.js";
import { DEBUG_MODE } from "#constants/index.js";

const app = express();
const PORT = process.env.PORT || 5006;

app.use(cors());
app.use(express.json());

app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ SSE streaming enabled`);
  console.log(`${DEBUG_MODE ? '🔧 DEBUG MODE: Conversations will NOT be saved' : '💾 Conversations will be saved to database'}`);
});
