const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
let rooms = {};

app.use(express.static('public'));

io.on("connection", socket => {
  let room, name;
  socket.on("joinRoom", data => {
    room = data.room; name = data.name;
    if (!rooms[room]) rooms[room] = { players: {}, food: { x: 10, y: 10 } };
    rooms[room].players[socket.id] = { id: socket.id, name, snake: [{ x: 2, y: 2 }], score: 0, dir: "right" };
    socket.join(room);
    io.to(room).emit("gameState", getState(room));
  });
  socket.on("update", data => {
    if (room && rooms[room]?.players[socket.id]) {
      rooms[room].players[socket.id].snake = data.snake;
      rooms[room].players[socket.id].score = data.score;
      io.to(room).emit("gameState", getState(room));
    }
  });
  socket.on("move", data => {
    if (room && rooms[room]?.players[socket.id]) {
      rooms[room].players[socket.id].dir = data.dir;
    }
  });
  socket.on("eatFood", () => {
    if (room && rooms[room]) {
      rooms[room].food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
      io.to(room).emit("gameState", getState(room));
    }
  });
  socket.on("restart", () => {
    if (room && rooms[room]?.players[socket.id]) {
      rooms[room].players[socket.id].snake = [{ x: 2, y: 2 }];
      rooms[room].players[socket.id].score = 0;
      rooms[room].players[socket.id].dir = "right";
      io.to(room).emit("gameState", getState(room));
    }
  });
  socket.on("disconnect", () => {
    if (room && rooms[room]?.players[socket.id]) {
      delete rooms[room].players[socket.id];
      io.to(room).emit("gameState", getState(room));
    }
  });
});

function getState(room) {
  if (!rooms[room]) return {};
  return { players: rooms[room].players, food: rooms[room].food };
}

const port = process.env.PORT || 3000;
http.listen(port, () => console.log("Server running on port " + port));
