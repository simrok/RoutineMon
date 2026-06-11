const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 업로드 폴더 자동 생성
['uploads/daily', 'uploads/party-quests'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const http = require('http');
const { Server } = require('socket.io');
const pool = require('./src/db/db');

const roomRoute = require('./src/routes/roomRoute');
const playerRoutes = require('./src/routes/playerRoutes');
const routineRoute = require('./src/routes/routineRoute');
const monsterRoute = require('./src/routes/monsterRoute');
const rankingRoute = require('./src/routes/rankingRoute');
const uploadRoute = require('./src/routes/uploadRoute');
const partyQuestRoute = require('./src/routes/partyQuestRoute');
const { startPartyQuestCron } = require('./src/cron/partyQuestCron');
const monCatalogRoutes = require('./src/routes/monCatalogRoutes');
const skinsRoutes = require('./src/routes/skinsRoutes');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "PUT", "DELETE"] }
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', roomRoute);
app.use('/api', playerRoutes);
app.use('/api', routineRoute);
app.use('/api', monsterRoute);
app.use('/api', rankingRoute);
app.use('/api', uploadRoute);
app.use('/api', partyQuestRoute);
app.use('/api/mon-catalog', monCatalogRoutes);
app.use('/api', skinsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

// ── Socket.io ─────────────────────────────────────────────────
const socketRegistry = {};

io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomCode, playerId }) => {
    socket.join(roomCode);
    socketRegistry[socket.id] = { roomCode, playerId };

    try {
      const [playerRows] = await pool.query(
        "SELECT slot_number AS slotNumber, nickname FROM players WHERE id = ?", [playerId]
      );
      if (playerRows.length > 0) {
        socket.to(roomCode).emit('room:player-joined', {
          playerId: Number(playerId),
          slotNumber: Number(playerRows[0].slotNumber),
          nickname: playerRows[0].nickname
        });
      }
    } catch (err) {
      console.error(err.message);
    }
  });

  socket.on('leave-room', ({ roomCode, playerId }) => {
    socket.leave(roomCode);
    delete socketRegistry[socket.id];
    io.to(roomCode).emit('room:player-left', { playerId: Number(playerId) });
  });

  socket.on('pin-reset:request', ({ roomCode, requestingPlayerId, nickname }) => {
    io.to(roomCode).emit('pin-reset:request', { requestingPlayerId, nickname });
  });

  socket.on('pin-reset:approve', ({ roomCode, approvingPlayerId, requestingPlayerId }) => {
    io.to(roomCode).emit('pin-reset:approve', { approvingPlayerId, requestingPlayerId });
  });

  socket.on('disconnect', () => {
    const playerData = socketRegistry[socket.id];
    if (playerData) {
      const { roomCode, playerId } = playerData;
      io.to(roomCode).emit('room:player-left', { playerId: Number(playerId) });
      delete socketRegistry[socket.id];
    }
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
  startPartyQuestCron(io);
});
