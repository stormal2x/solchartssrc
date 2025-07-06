import React, { useEffect, useState } from 'react';

// Show live (unrealized) PnL for the open position
export default function LivePnl({ position, currentPrice }) {
  const [livePnl, setLivePnl] = useState(0);

  useEffect(() => {
    function calcPnl() {
      if (!position) return 0;
      let priceMove;
      if (position.direction === 'long') {
        priceMove = (currentPrice - position.entryPrice) / position.entryPrice;
      } else {
        priceMove = (position.entryPrice - currentPrice) / position.entryPrice;
      }
      return position.amount * priceMove * position.leverage;
    }
    setLivePnl(calcPnl());
    const interval = setInterval(() => {
      setLivePnl(calcPnl());
    }, 1000);
    return () => clearInterval(interval);
  }, [position, currentPrice]);

  let color = livePnl > 0 ? '#1eea7c' : livePnl < 0 ? '#ff4e4e' : '#fff';
  return (
    <div style={{marginTop:8, color, fontWeight:700, fontSize:15, textAlign:'center'}}>
      Live PnL: {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} $FREE
    </div>
  );
}
