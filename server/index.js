const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

app.use(cors());
app.use(express.json());

app.use('/api', roomRoute);
app.use('/api', playerRoutes);
app.use('/api', routineRoute);
app.use('/api', monsterRoute);
app.use('/api', rankingRoute);
app.use('/api', uploadRoute);
app.use('/api', partyQuestRoute);
app.use('/api', monCatalogRoutes);
app.use('/api', skinsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
});
