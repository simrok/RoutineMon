const express = require('express');
const cors = require('cors');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const pool = require('./db/db'); // DB 풀 연결

const roomRoute = require('./src/routes/roomRoute');
const playerRoutes = require('./src/routes/playerRoutes');
const routineRoute = require('./src/routes/routineRoute');
const monsterRoute = require('./src/routes/monsterRoute');
const rankingRoute = require('./src/routes/rankingRoute');
const uploadRoute = require('./src/routes/uploadRoute');
const partyQuestRoute = require('./src/routes/partyQuestRoute');
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

// 🌟 명세서 기반 라우터 연결
app.use('/api', roomRoute);
app.use('/api', playerRoutes);
app.use('/api', routineRoute);
app.use('/api', monsterRoute);
app.use('/api', rankingRoute);
app.use('/api', uploadRoute);
app.use('/api', partyQuestRoute);
app.use('/api', monCatalogRoutes);
app.use('/api', skinsRoutes);

// ==========================================================
// 🌟 [명세서 6번 추가 교정] POST /api/party-quests/:partyQuestId/accept
// ==========================================================
app.post('/api/party-quests/:partyQuestId/accept', async (req, res) => {
  const { partyQuestId } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ success: false, error: 'playerId가 누락되었습니다.' });
  }

  const connection = await pool.getConnection();
  try {
    // 현재 룸 코드 조회를 위해 JOIN
    const [questRows] = await connection.query(
      "SELECT pq.*, r.room_code FROM party_quests pq JOIN rooms r ON pq.room_id = r.id WHERE pq.id = ?",
      [partyQuestId]
    );

    if (questRows.length === 0) {
      return res.status(404).json({ success: false, error: '존재하지 않는 파티 퀘스트입니다.' });
    }

    const roomCode = questRows[0].room_code;
    
    // 만료 시간 설정 (현재 시간 기준 2시간 후)
    const kstOffset = 9 * 60 * 60 * 1000;
    const expiresAtDate = new Date(new Date().getTime() + kstOffset + (2 * 60 * 60 * 1000));
    const expiresAt = expiresAtDate.toISOString().slice(0, 19).replace('T', ' ');

    // 🌟 상태를 pending -> active로 변경 및 수락 유저 기록
    await connection.query(
      "UPDATE party_quests SET status = 'active', accepted_by_player_id = ?, expires_at = ? WHERE id = ?",
      [playerId, expiresAt, partyQuestId]
    );

    // 📡 [명세서 10번 소켓 송출] party-quest:accepted 발송
    const ioServer = req.app.get('io');
    if (ioServer && roomCode) {
      ioServer.to(roomCode).emit('party-quest:accepted', {
        partyQuestId: Number(partyQuestId),
        acceptedByPlayerId: Number(playerId),
        expiresAt: expiresAtDate.toISOString() // 표준 ISO 형식 제공
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        partyQuestId: Number(partyQuestId),
        status: "active",
        expiresAt: expiresAtDate.toISOString()
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

// ==========================================
// 📡 Socket.io 클라이언트 커넥션 허브
// ==========================================
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

// ==========================================
// ⏰ [명세서 교정 스케줄러] 정각 시 퀘스트를 'pending' 상태로 발급
// ==========================================
setInterval(async () => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  
  const hours = kstDate.getUTCHours();
  const minutes = kstDate.getUTCMinutes();

  if ((hours === 1 || hours === 7 || hours === 13 || hours === 19) && minutes === 0) {
    try {
      // 1. 미완료된 기존 활성 퀘스트들은 만료 실패 처리
      const [activeQuests] = await pool.query(
        "SELECT pq.id, r.room_code FROM party_quests pq JOIN rooms r ON pq.room_id = r.id WHERE pq.status IN ('active', 'accepted')"
      );
      for (const quest of activeQuests) {
        await pool.query("UPDATE party_quests SET status = 'failed' WHERE id = ?", [quest.id]);
        io.to(quest.room_code).emit('party-quest:failed', { partyQuestId: Number(quest.id) });
      }

      // 2. 모든 방에 명세서 맞춤형 'pending' 대기 상태 퀘스트 발급
      const [rooms] = await pool.query("SELECT id, room_code FROM rooms");
      for (const room of rooms) {
        const [defs] = await pool.query("SELECT id, content FROM party_quest_definitions ORDER BY RAND() LIMIT 1");
        if (defs.length > 0) {
          const definitionId = defs[0].id;
          const content = defs[0].content;

          const [insertResult] = await pool.query(
            "INSERT INTO party_quests (room_id, definition_id, status) VALUES (?, ?, 'pending')",
            [room.id, definitionId]
          );

          // 📡 [명세서 10번] 새 퀘스트 알림 전송
          io.to(room.room_code).emit('party-quest:new', {
            partyQuestId: Number(insertResult.insertId),
            content: content
          });
        }
      }
    } catch (err) {
      console.error("스케줄러 에러:", err.message);
    }
  }
}, 60000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅ 명세서 100% 매칭 완료 서버가 포트 ${PORT}에서 가동 중입니다.`);
});