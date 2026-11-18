require('dotenv').config();
const { trustedGateway } = require('../shared/security');
const express = require('express');
const cors = require('cors');
const authController = require('./authController');

const app = express();
const port = 3000;

app.use(trustedGateway);
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('✅ User microservice is running');
});

// Public routes (called via gateway)
app.post('/api/login', authController.login);
app.post('/api/logout', authController.logout);
app.get('/api/session', authController.validateSession);
app.post('/api/register', authController.register);
app.post('/api/changePassword', authController.updatePassword);

app.listen(port, () => {
  console.log(`User service listening at http://localhost:${port}`);
});
