/**
 * Shared celebration animation for all exercise counters.
 * Usage: createCelebration(count, label, storageKey, redirectUrl)
 */
function createCelebration(count, label, storageKey, redirectUrl) {
  const overlay = document.createElement('div');
  overlay.id = 'celebration-overlay';
  overlay.innerHTML = `
    <div class="celeb-content">
      <div class="celeb-count">${count}</div>
      <div class="celeb-label">${label} ⚡</div>
      <div class="celeb-msg">MEGA STARK! 💪🔥</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = `
    #celebration-overlay {
      position:fixed; inset:0; z-index:9999;
      background:radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a15 100%);
      display:flex; align-items:center; justify-content:center;
      overflow:hidden;
    }
    .celeb-content { text-align:center; z-index:10; position:relative; animation: celeb-pop .5s cubic-bezier(.17,.67,.35,1.5) forwards; opacity:0; }
    .celeb-count { font-size:6rem; font-weight:900; color:#facc15; text-shadow: 0 0 40px rgba(250,204,21,.7), 0 0 80px rgba(250,204,21,.4); }
    .celeb-label { font-size:2rem; font-weight:800; color:#fff; letter-spacing:4px; margin-top:-8px; }
    .celeb-msg { font-size:1.3rem; color:#a78bfa; margin-top:16px; font-weight:700; animation: celeb-pulse 1s ease-in-out infinite; }
    @keyframes celeb-pop { 0%{opacity:0;transform:scale(0.3)} 100%{opacity:1;transform:scale(1)} }
    @keyframes celeb-pulse { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
    .bolt {
      position:absolute; font-size:2rem; opacity:0; z-index:5; pointer-events:none;
      animation: bolt-fall linear forwards;
      filter: drop-shadow(0 0 8px rgba(250,204,21,.8));
    }
    @keyframes bolt-fall {
      0% { opacity:0; transform:translateY(-60px) rotate(0deg) scale(0.5); }
      15% { opacity:1; transform:translateY(0) scale(1); }
      85% { opacity:1; }
      100% { opacity:0; transform:translateY(calc(100vh + 40px)) rotate(360deg) scale(0.3); }
    }
    .sparkle {
      position:absolute; width:4px; height:4px; border-radius:50%; z-index:4; pointer-events:none;
      animation: sparkle-fly linear forwards;
    }
    @keyframes sparkle-fly {
      0% { opacity:1; transform:translate(0,0) scale(1); }
      100% { opacity:0; transform:translate(var(--dx), var(--dy)) scale(0); }
    }
    .ring {
      position:absolute; top:50%; left:50%; width:20px; height:20px; border-radius:50%;
      border:3px solid #facc15; z-index:3; pointer-events:none; opacity:0;
      transform:translate(-50%,-50%) scale(0);
      animation: ring-expand .8s ease-out forwards;
    }
    @keyframes ring-expand {
      0% { opacity:.8; transform:translate(-50%,-50%) scale(0); }
      100% { opacity:0; transform:translate(-50%,-50%) scale(8); }
    }
  `;
  document.head.appendChild(style);

  const bolts = ['⚡','⚡','🔥','💛','⭐','✨','💥','🌟'];
  const boltInterval = setInterval(() => {
    const b = document.createElement('div');
    b.className = 'bolt';
    b.textContent = bolts[Math.floor(Math.random()*bolts.length)];
    b.style.left = Math.random()*100 + 'vw';
    b.style.top = '-40px';
    b.style.fontSize = (1.2 + Math.random()*2) + 'rem';
    b.style.animationDuration = (1.5 + Math.random()*2) + 's';
    b.style.animationDelay = Math.random()*0.3 + 's';
    overlay.appendChild(b);
    setTimeout(() => b.remove(), 4000);
  }, 80);

  for(let w=0;w<3;w++){
    setTimeout(()=>{
      for(let i=0;i<20;i++){
        const s = document.createElement('div');
        s.className='sparkle';
        const angle=Math.random()*Math.PI*2;
        const dist=100+Math.random()*200;
        s.style.setProperty('--dx', Math.cos(angle)*dist+'px');
        s.style.setProperty('--dy', Math.sin(angle)*dist+'px');
        s.style.left='50%'; s.style.top='50%';
        s.style.background=['#facc15','#f97316','#a78bfa','#34d399','#fff'][Math.floor(Math.random()*5)];
        s.style.width=s.style.height=(3+Math.random()*5)+'px';
        s.style.animationDuration=(.6+Math.random()*.6)+'s';
        overlay.appendChild(s);
        setTimeout(()=>s.remove(),1500);
      }
      const ring=document.createElement('div');
      ring.className='ring';
      ring.style.animationDelay='.1s';
      overlay.appendChild(ring);
      setTimeout(()=>ring.remove(),1000);
    }, w*600);
  }

  setTimeout(() => {
    clearInterval(boltInterval);
    localStorage.setItem(storageKey, count);
    const storedReturnPath = localStorage.getItem('boost_return_path');
    localStorage.removeItem('boost_return_path');
    window.location.href = storedReturnPath || redirectUrl || '/challenge/daily';
  }, 3500);
}
