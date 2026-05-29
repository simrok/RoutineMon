const express = require('express');
const cors = require('cors');
require('dotenv').config();

const roomRoute = require('./src/routes/roomRoute');
const routineRoute = require('./src/routes/routineRoute');
const monsterRoute = require('./src/routes/monsterRoute');
const rankingRoute = require('./src/routes/rankingRoute');
const uploadRoute = require('./src/routes/uploadRoute'); // 👈 업로드 라우터 추가!

const app = express();

app.use(cors());                      
app.use(express.json());              

app.use('/api', roomRoute);
app.use('/api', routineRoute);
app.use('/api', monsterRoute);        
app.use('/api', rankingRoute);        
app.use('/api', uploadRoute);         // 👈 업로드 라우터 등록!

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
});