// SNAKEY SNAKEY Multiplayer Server
// 50x50 grid, 7 foods, top scorer disco, custom player color by nickname

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });

const GRID_SIZE = 50;
const FOOD_COUNT = 7;
const centerCell = { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) };

let rooms = {};

function randomEmptyCell(occupied = []) {
  let pos;
  let tries = 0;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    tries++;
  } while (
    occupied.some(o => o.x === pos.x && o.y === pos.y) && tries < 300
  );
  return pos;
}

function initFoods(snakes) {
  let occupied = [];
  snakes.forEach(s => occupied = occupied.concat(s));
  let foods = [];
  let safety = 0;
  while (foods.length < FOOD_COUNT && safety < 1000) {
    const pos = randomEmptyCell(foods.concat(occupied));
    if (!foods.some(f => f.x === pos.x && f.y === pos.y)) {
      foods.push(pos);
    }
    safety++;
  }
  return foods;
}

function hashNick(nick) {
  let hash = 0;
  for (let i = 0; i < nick.length; i++) {
    hash = ((hash << 5) - hash) + nick.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

io.on('connection', socket => {
  let room, name;

  socket.on('joinRoom', data => {
    room = data.room ? String(data.room).slice(0, 40) : "default";
    name = data.name ? String(data.name).slice(0, 24) : "anon";
    if (!rooms[room]) {
      rooms[room] = {
        players: {},
        foods: []
      };
    }
    // Remove ghost slot if present
    delete rooms[room].players[socket.id];
    rooms[room].players[socket.id] = {
      id: socket.id,
      name: name,
      colorSeed: hashNick(name),
      snake: [{ x: centerCell.x, y: centerCell.y }],
      score: 0,
      dir: 'right',
      moveTime: 0,
      joined: Date.now()
    };
    const snakesFlat = Object.values(rooms[room].players).map(p => p.snake).flat();
    if (rooms[room].foods.length < FOOD_COUNT) {
      rooms[room].foods = initFoods(snakesFlat);
    }
    socket.join(room);
    io.to(room).emit('gameState', getState(room));
  });

  function canMove(player) {
    const now = Date.now();
    if (now - player.moveTime < 60) return false;
    player.moveTime = now;
    return true;
  }

  socket.on('update', data => {
    if (!room || !rooms[room] || !rooms[room].players[socket.id]) return;
    const player = rooms[room].players[socket.id];
    if (!canMove(player)) return;
    player.snake = Array.isArray(data.snake) ? data.snake : player.snake;
    player.score = typeof data.score === 'number' ? data.score : player.score;
    io.to(room).emit('gameState', getState(room));
  });

  socket.on('eatFood', coords => {
    if (!room || !rooms[room]) return;
    let foods = rooms[room].foods || [];
    foods = foods.filter(f => !(f.x === coords.x && f.y === coords.y));
    const snakesFlat = Object.values(rooms[room].players).map(p => p.snake).flat();
    let safety = 0;
    while (foods.length < FOOD_COUNT && safety < 1000) {
      const newPos = randomEmptyCell(foods.concat(snakesFlat));
      if (!foods.some(f => f.x === newPos.x && f.y === newPos.y)) {
        foods.push(newPos);
      }
      safety++;
    }
    rooms[room].foods = foods;
    io.to(room).emit('gameState', getState(room));
  });

  socket.on('restart', () => {
    if (!room || !rooms[room] || !rooms[room].players[socket.id]) return;
    rooms[room].players[socket.id].score = 0;
    rooms[room].players[socket.id].snake = [{ x: centerCell.x, y: centerCell.y }];
    rooms[room].players[socket.id].dir = 'right';
    io.to(room).emit('gameState', getState(room));
  });

  socket.on('disconnect', () => {
    if (!room || !rooms[room]) return;
    delete rooms[room].players[socket.id];
    if (Object.keys(rooms[room].players).length === 0) {
      delete rooms[room];
    } else {
      io.to(room).emit('gameState', getState(room));
    }
  });
});

function getState(room) {
  if (!rooms[room]) return {};
  let bestPlayerId = null, maxScore = -1, earliest = Date.now() + 100000;
  for (let pid in rooms[room].players) {
    let p = rooms[room].players[pid];
    if (p.score > maxScore || (p.score === maxScore && p.joined < earliest)) {
      bestPlayerId = p.id;
      maxScore = p.score;
      earliest = p.joined;
    }
  }
  let playerStates = {};
  for (let pid in rooms[room].players) {
    let p = rooms[room].players[pid];
    playerStates[pid] = { ...p, disco: (pid === bestPlayerId) };
  }
  return {
    players: playerStates,
    foods: rooms[room].foods
  };
}

const port = process.env.PORT || 3000;
http.listen(port, () => console.log('SNAKEY SNAKEY server running on port ' + port));
