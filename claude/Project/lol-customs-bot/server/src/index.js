require('dotenv').config({ path: '../.env' });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// 라우터 (Phase 3에서 구현)
// app.use('/api/session', require('./routes/session'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Socket.io (Phase 3에서 구현)
io.on('connection', (socket) => {
  console.log(`[소켓 연결] ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[소켓 해제] ${socket.id}`);
  });
});

// io 인스턴스를 앱에 붙여서 라우터에서 접근 가능하게
app.set('io', io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[서버 시작] http://localhost:${PORT}`);
});
