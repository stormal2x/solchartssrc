const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory user session
let user = {
  balances: {
    SOL: 100,
    FREE: 1000
  },
  currency: 'SOL'
};

// Get current balance and currency
app.get('/balance', (req, res) => {
  res.json({
    currency: user.currency,
    balance: user.balances[user.currency],
    balances: user.balances
  });
});

// Switch currency
app.post('/switch-currency', (req, res) => {
  const { currency } = req.body;
  if (currency !== 'SOL' && currency !== 'FREE') {
    return res.status(400).json({ error: 'Invalid currency' });
  }
  user.currency = currency;
  res.json({ currency });
});

// Place a bet on up/down
app.post('/bet', (req, res) => {
  const { amount, direction } = req.body;
  if (amount <= 0 || !['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'Invalid bet' });
  }
  if (user.balances[user.currency] < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  // Simulate price movement
  const priceMoved = Math.random() < 0.5 ? 'up' : 'down';
  let win = direction === priceMoved;
  if (win) {
    user.balances[user.currency] += amount;
  } else {
    user.balances[user.currency] -= amount;
  }
  res.json({
    win,
    priceMoved,
    newBalance: user.balances[user.currency]
  });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Casino backend running on port ${PORT}`);
});
