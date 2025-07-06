import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine } from 'recharts';
import DraggablePanel from './DraggablePanel';
import LivePnl from './LivePnl';

// Global style for font smoothing and icon sizing
const globalStyle = `
  html, body, #root {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #181A20;
    color: #f1f1f1;
  }
  .smooth-text {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: 0.01em;
  }
  .icon {
    width: 22px;
    height: 22px;
    display: inline-block;
    vertical-align: middle;
  }
`;

const API_URL = 'http://localhost:4000';

function App() {
  const [freeBalance, setFreeBalance] = useState(10000); // Only $FREE, default 10,000
  const [amount, setAmount] = useState('');
  const [position, setPosition] = useState(null); // { entryPrice, amount, entryTime, leverage }
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leverage, setLeverage] = useState(1);
  const [priceHistory, setPriceHistory] = useState(() => generateInitialHistory());



  // Generate initial price history
  function generateInitialHistory() {
    let data = [];
    let price = 100;
    for (let i = 0; i < 20; i++) {
      price += (Math.random() - 0.5) * 2;
      data.push({
        time: i + 1,
        price: Number(price.toFixed(2))
      });
    }
    return data;
  }

  // Helper: get current price
  const currentPrice = priceHistory[priceHistory.length - 1]?.price || 100;

  // Continuously add new price points for area/line chart
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceHistory(prev => {
        let last = prev[prev.length - 1];
        let newPrice = last.price + (Math.random() - 0.5) * 2;
        if (newPrice < 1) newPrice = 1;
        let next = { time: last.time + 1, price: Number(newPrice.toFixed(2)) };
        return [...prev.slice(-59), next];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-close position at liquidation
  useEffect(() => {
    if (!position) return;
    let liq = position.direction === 'long'
      ? position.entryPrice * (1 - 1 / position.leverage)
      : position.entryPrice * (1 + 1 / position.leverage);
    if (
      (position.direction === 'long' && currentPrice <= liq) ||
      (position.direction === 'short' && currentPrice >= liq)
    ) {
      handleSell();
    }
    // eslint-disable-next-line
  }, [currentPrice, position]);

  // Reset balance to default
  const handleResetBalance = () => {
    setFreeBalance(10000);
    setPosition(null);
    setResult(null);
  };


  // Buy: open a position
  const handleBuy = async () => {
    setLoading(true);
    setResult(null);
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Invalid amount');
      if (freeBalance < amt) throw new Error('Insufficient balance');
      setFreeBalance(prev => prev - amt);
      setPosition({
        entryPrice: currentPrice,
        amount: amt,
        entryTime: priceHistory[priceHistory.length - 1].time,
        leverage,
        direction: tradeDirection
      });
    } catch (e) {
      setResult({ error: e.response?.data?.error || e.message || 'Buy failed' });
    }
    setLoading(false);
  };

  // Sell: close position
  const handleSell = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (!position) throw new Error('No open position');
      let liq;
      if (position.direction === 'long') {
        liq = position.entryPrice * (1 - 1 / position.leverage);
      } else {
        liq = position.entryPrice * (1 + 1 / position.leverage);
      }
      let pnl = 0;
      let liquidated = false;
      if (position.direction === 'long' && currentPrice <= liq) {
        pnl = -position.amount;
        liquidated = true;
      } else if (position.direction === 'short' && currentPrice >= liq) {
        pnl = -position.amount;
        liquidated = true;
      } else {
        // PnL: for every 1% move in your favor, you gain leverage x 1% of entry
        let priceMove;
        if (position.direction === 'long') {
          priceMove = (currentPrice - position.entryPrice) / position.entryPrice;
        } else {
          priceMove = (position.entryPrice - currentPrice) / position.entryPrice;
        }
        pnl = position.amount * priceMove * position.leverage;
      }
      setFreeBalance(prev => prev + (liquidated ? 0 : position.amount) + Number(pnl.toFixed(2))); // Only return entry if not liquidated
      setResult({
        closed: true,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        amount: position.amount,
        pnl: Number(pnl.toFixed(2)),
        leverage: position.leverage,
        direction: position.direction,
        liquidated,
      });
      setPosition(null);
    } catch (e) {
      setResult({ error: e.response?.data?.error || e.message || 'Sell failed' });
    }
    setLoading(false);
  };

  // --- Chat state and logic ---
  const [chatMessages, setChatMessages] = useState([]); // {user, text}
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = React.useRef(null);

  // Trade direction: 'long' or 'short'
  const [tradeDirection, setTradeDirection] = useState('long');
  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatMessages(msgs => [...msgs, { user: "user", text: msg }]);
    setChatInput("");
  };
  const handleChatKeyDown = e => {
    if (e.key === "Enter") handleSendChat();
  };
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // For DraggablePanel default position
  const [panelDefaultPos, setPanelDefaultPos] = useState({ x: 1000, y: 40 });
  useEffect(() => {
    setPanelDefaultPos({ x: (window.innerWidth || 1400) - 420, y: 40 });
  }, []);

  // Guard for auto-liquidation
  const autoLiquidatedRef = React.useRef(false);

  useEffect(() => {
    if (!position) {
      autoLiquidatedRef.current = false;
      return;
    }
    let liq = position.direction === 'long'
      ? position.entryPrice * (1 - 1 / position.leverage)
      : position.entryPrice * (1 + 1 / position.leverage);
    if (
      !autoLiquidatedRef.current &&
      ((position.direction === 'long' && currentPrice <= liq) ||
        (position.direction === 'short' && currentPrice >= liq))
    ) {
      autoLiquidatedRef.current = true;
      handleSell();
    }
    // eslint-disable-next-line
  }, [currentPrice, position]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#181a22', color: '#f1f1f1', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        <style>{globalStyle}</style>
        {/* Chat sidebar - single, left */}
        <div style={{ width: 340, minWidth: 220, maxWidth: 400, background: '#23272f', borderRight: '2px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', zIndex: 10, boxShadow: '2px 0 18px 0 rgba(31,38,135,0.10)' }}>
          <div style={{fontWeight: 700, fontSize: 22, padding: '26px 26px 12px 26px', borderBottom: '1.5px solid #262a32'}}>Chat</div>
          <div style={{ flex: 1, padding: '18px 26px 8px 26px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
            {chatMessages.slice(-8).map((msg, i) => (
              <div key={i} className="smooth-text" style={{ color: '#fff', background: '#23272f', borderRadius: 10, padding: '10px 14px', alignSelf: 'flex-start', maxWidth: '100%', boxShadow: '0 1px 8px 0 rgba(31,38,135,0.08)', fontSize: 16 }}>
                <span className="smooth-text" style={{ fontWeight: 700, color: '#1eea7c', marginRight: 10 }}>{msg.user}:</span>
                <span className="smooth-text">{msg.text}</span>
              </div>
            ))}
          </div>
          {/* Only one chat input at the bottom */}
          <div style={{ padding: 18, borderTop: '1.5px solid #262a32', background: '#22242a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Type a message..."
              style={{ flex: 1, borderRadius: 8, border: '1px solid #353943', padding:'10px 14px', background:'#23272f', color:'#f1f1f1', fontSize: 15 }}
            />
            <button onClick={handleSendChat} style={{ background:'#8884d8', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:600, fontSize:15, cursor: chatInput.trim() ? 'pointer' : 'not-allowed', opacity: chatInput.trim() ? 1 : 0.6 }}>Send</button>
          </div>
        </div>
        {/* Main right area: top bar + chart/trading panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
          {/* Top compact balance bar */}
          <div style={{ width: '100%', height: 54, background: 'rgba(30,34,44,0.98)', borderBottom: '1.5px solid #22242a', display: 'flex', alignItems: 'center', padding: '0 32px', boxSizing: 'border-box', zIndex: 30 }}>
            <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 0.5, color: '#f1f1f1', marginRight: 18 }}>$FREE Balance:</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#1eea7c', marginRight: 18 }}>{freeBalance.toFixed(2)} $FREE</span>
            <button onClick={handleResetBalance} style={{ marginLeft: 10, background:'#23272f', color:'#1eea7c', border:'1.5px solid #1eea7c', borderRadius:8, padding:'8px 18px', fontWeight:600, fontSize:15, cursor:'pointer' }}>Reset Balance</button>
          </div>
          {/* Chart/trading panel fills rest of area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory} margin={{ top: 32, right: 32, left: 32, bottom: 32 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={false} axisLine={false} style={{fontSize:18}}/>
                <YAxis domain={['auto', 'auto']} width={60} axisLine={false} tick={{fill:'#aaa',fontSize:18}}/>
                <CartesianGrid strokeDasharray="3 3" stroke="#23272f" />
                <Tooltip formatter={(value) => `$${value}`}/>
                <Area type="monotone" dataKey="price" stroke="#8884d8" fillOpacity={1} fill="url(#colorPrice)" />
                {/* Draw a white line at liquidation price if position is open */}
        {position && (() => {
          let liq;
          if (position.direction === 'long') {
            liq = position.entryPrice * (1 - 1 / position.leverage);
          } else {
            liq = position.entryPrice * (1 + 1 / position.leverage);
          }
          return (
            <>
              <YAxis type="number" yAxisId="liq" hide domain={['auto', 'auto']} />
              <ReferenceLine y={liq} stroke="#fff" strokeWidth={2} strokeDasharray="6 3" label={(props) => {
  const { viewBox } = props;
  return (
    <g>
      <rect x={viewBox.x + 8} y={viewBox.y - 24} width={90} height={22} fill="#fff" rx={6} />
      <text x={viewBox.x + 16} y={viewBox.y - 10} fill="#23272f" fontWeight="700" fontSize="13">Liquidation</text>
    </g>
  );
}} />
            </>
          );
        })()}
      </AreaChart>
            </ResponsiveContainer>
            {/* Floating trading panel, draggable */}
            <DraggablePanel
              bounds={{ left: 0, top: 0, right: 0, bottom: 0 }}
              defaultPosition={panelDefaultPos}
            >
              <div style={{ background:'#22242a', borderRadius: 18, padding: '28px 24px', boxShadow:'0 2px 24px 0 rgba(31,38,135,0.18)', border: '1px solid #23272f', minWidth: 320, maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'stretch', zIndex: 20 }}>

                <div style={{fontWeight:700,marginBottom:14,fontSize:19, textAlign: 'center'}}>Live Trading Game</div>
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'center', marginBottom: 18}}>
                {/* Long/Short Direction Toggle */}
                <button
                  type="button"
                  onClick={() => setTradeDirection('long')}
                  disabled={!!position}
                  style={{
                    background: tradeDirection === 'long' ? '#1eea7c' : 'transparent',
                    color: tradeDirection === 'long' ? '#23272f' : '#1eea7c',
                    border: `2px solid #1eea7c`,
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 16,
                    padding: '8px 24px',
                    marginRight: 4,
                    cursor: !!position ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    boxShadow: tradeDirection === 'long' ? '0 1px 6px 0 rgba(30,234,124,0.10)' : undefined
                  }}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => setTradeDirection('short')}
                  disabled={!!position}
                  style={{
                    background: tradeDirection === 'short' ? '#ff4e4e' : 'transparent',
                    color: tradeDirection === 'short' ? '#fff' : '#ff4e4e',
                    border: `2px solid #ff4e4e`,
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 16,
                    padding: '8px 24px',
                    marginRight: 8,
                    cursor: !!position ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    boxShadow: tradeDirection === 'short' ? '0 1px 6px 0 rgba(255,78,78,0.10)' : undefined
                  }}
                >
                  Short
                </button>
                <input
                  type="number"
                  min="1"
                  placeholder="Amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  disabled={!!position}
                  style={{ width: 60, borderRadius: 6, border: '1px solid #353943', padding: '6px 8px', background:'#23272f', color:'#f1f1f1', fontSize: 14, marginRight: 6, fontWeight: 600 }}
                />
                <span style={{marginRight:4, fontSize:13, fontWeight:700}}>
                  Leverage:{' '}
                  <select value={leverage} onChange={e => setLeverage(Number(e.target.value))} disabled={!!position} style={{background:'#23272f',color:'#f1f1f1',border:'1px solid #353943',borderRadius:6,padding:'5px 8px',fontSize:13,fontWeight:700}}>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                    <option value={20}>20x</option>
                    <option value={50}>50x</option>
                    <option value={100}>100x</option>
                  </select>
                </span>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:10}}>
                <button
                  disabled={loading || !!position || !amount}
                  onClick={handleBuy}
                  title={`Buy (${tradeDirection === 'long' ? 'Long' : 'Short'})`}
                  style={{
                    marginRight: 6,
                    background: tradeDirection === 'long' ? '#1eea7c' : '#ff4e4e',
                    color:'#fff',
                    border:'none',
                    borderRadius:10,
                    padding:'10px 30px',
                    fontWeight:700,
                    fontSize:16,
                    cursor: loading || !!position || !amount ? 'not-allowed':'pointer',
                    transition:'background 0.2s',
                    boxShadow: tradeDirection === 'long' ? '0 1px 8px 0 rgba(30,234,124,0.12)' : '0 1px 8px 0 rgba(255,78,78,0.12)'
                  }}>
                  Buy
                </button>
                <button
                  disabled={loading || !position}
                  onClick={handleSell}
                  title="Sell (close position)"
                  style={{
                    marginRight: 0,
                    background:'#23272f',
                    color:'#fff',
                    border:'2px solid #8884d8',
                    borderRadius:10,
                    padding:'10px 30px',
                    fontWeight:700,
                    fontSize:16,
                    cursor: loading || !position ? 'not-allowed':'pointer',
                    transition:'background 0.2s',
                    boxShadow:'0 1px 8px 0 rgba(136,132,216,0.10)'
                  }}>
                  Sell
                </button>
              </div>
              {position && (() => {
  // Calculate liquidation price
  let liq;
  if (position.direction === 'long') {
    liq = position.entryPrice * (1 - 1 / position.leverage);
  } else {
    liq = position.entryPrice * (1 + 1 / position.leverage);
  }
  return (
    <>
      <div style={{marginTop:8, color:'#1eea7c', fontWeight:700, fontSize:13, textAlign: 'center'}}>
        Open Position: {position.amount} $FREE @ ${position.entryPrice} ({position.leverage}x, {position.direction})
      </div>
      <div style={{marginTop:4, color:'#fff', fontWeight:600, fontSize:13, textAlign: 'center'}}>
        Liquidation Price: <span style={{color:'#fff', background:'#23272f', borderRadius:6, padding:'2px 7px', fontWeight:700}}>${liq.toFixed(2)}</span>
      </div>
    </>
  );
})()}
          {/* Live PnL display */}
          {position && (
            <LivePnl position={position} currentPrice={currentPrice} />
          )}
          {result && (
            <div style={{marginTop:8, color: result.error ? '#ff4e4e' : '#1eea7c', fontWeight:700, fontSize:13, textAlign: 'center'}}>
              {result.error ? result.error : `Closed: ${result.amount} $FREE, PnL: $${result.pnl} $FREE`}
            </div>
          )}
        </div>
      </DraggablePanel>
      </div> {/* close chart/trading panel */}
    </div> {/* close main right area */}
    </div>
  );
}

export default App;
