const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/focusmap', require('./routes/focusmap'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/worries', require('./routes/worries'));
app.use('/api/longgoals', require('./routes/longgoals'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/notify', require('./routes/notify'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
