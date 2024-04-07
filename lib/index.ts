import { createServer } from "http";
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { config } from "dotenv";
import cors from "cors";
import { Server } from "socket.io";

import { batchTranscriptionJob } from "./controllers/audio-controller";
import { CustomAudioChunk } from "./utils/types";

config();

const normalizePort = (val: string) => {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;

  return false;
};

function onError(error: any) {
  if (error.syscall !== "listen") throw error;

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;
  console.info("Listening on " + bind);
}

const WHITELISTED_ORIGINS = ["http://localhost:8000", "http://localhost:8001", "https://insightbud.fly.dev"];

const port = normalizePort(process.env.PORT || "8000");
const app = express();
app.set("port", port);
app.use(
  cors({
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(cookieParser());
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: WHITELISTED_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.info("a user connected", socket.handshake.url);
  socket.on("disconnect", () => {
    console.info("user disconnected", socket.handshake.url);
  });

  socket.on("audio-chunk", async (data: CustomAudioChunk) => {
    console.info("audio-chunk received", data.id);
    await batchTranscriptionJob({
      data,
      io,
    });
  });
});

// serve .wav files in /data
app.use("/data", express.static("data"));

app.get("*", (_req, res) => {
  res.json({ message: "Hello from the server!" });
});

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);
