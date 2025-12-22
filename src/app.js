const express = require('express');
const app = express();

app.use(express.json());

app.use('/api/users', require('./routes/user.routes'));

app.get('/health', (_, res) => {
  res.json({ status: 'OK' });
});

module.exports = app;
