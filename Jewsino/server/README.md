# Jewsino Casino Backend

This is the backend API for the Jewsino casino app prototype.

## Features
- Simulates user balances in $SOL and $FREE
- Allows switching between currencies
- Trading prediction game: bet on price going up or down
- Simple REST API

## Endpoints
- `GET /balance` - Get current balance and currency
- `POST /switch-currency` - Switch between $SOL and $FREE
- `POST /bet` - Place a bet (amount, direction)

## Running
```
npm install
npm start
```

Runs on port 4000 by default.
