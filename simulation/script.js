const timeline = document.getElementById('timeline');
const log = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const modeAot = document.getElementById('modeAot');

const SLOT_COUNT = 10;
let slots = [];

function init() {
  timeline.innerHTML = '';
  slots = [];
  for (let i=1;i<=SLOT_COUNT;i++){
    const el = document.createElement('div');
    el.className = 'slot';
    el.id = 'slot-'+i;
    el.innerHTML = `<div>Slot<br>${i}</div>`;
    timeline.appendChild(el);
    slots.push({id:i, state:'idle', el});
  }
  log.innerHTML = 'Ready. Click Start Simulation.';
}

function addLog(text){
  const p = document.createElement('div');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  log.prepend(p);
}

function simulate(){
  addLog('Simulation started. Mode: ' + (modeAot.checked ? 'AOT' : 'JIT'));
  let txId = 1;
  const txs = [
    {id:txId++, prefer: modeAot.checked ? 2 : null},
    {id:txId++, prefer: modeAot.checked ? 4 : null},
    {id:txId++, prefer: null},
    {id:txId++, prefer: null}
  ];
  txs.forEach((tx, idx) => {
    setTimeout(()=>{
      if (modeAot.checked && tx.prefer){
        const s = slots.find(x=>x.id===tx.prefer);
        s.state='reserved';
        s.el.classList.add('reserved');
        addLog(`TX ${tx.id} reserved slot ${s.id} (AOT)`);
      } else {
        const s = slots.find(x=>x.state==='idle');
        if (s){
          s.state='pending';
          s.el.style.border='2px dashed #ff99cc';
          addLog(`TX ${tx.id} submitted, waiting for slot ${s.id}`);
          setTimeout(()=> executeTx(tx.id, s.id), 1500 + Math.random()*1200);
        } else {
          addLog(`TX ${tx.id} dropped: no free slot`);
        }
      }
    }, 800*idx);
  });
  if (modeAot.checked){
    setTimeout(()=> {
      slots.filter(s=>s.state==='reserved').forEach((s, i)=>{
        setTimeout(()=>executeTx('AOT-'+s.id, s.id), 1000*i + 800);
      });
    }, 2200);
  }
}

function executeTx(txId, slotId){
  const s = slots.find(x=>x.id===slotId);
  s.state='executed';
  s.el.classList.remove('reserved');
  s.el.classList.add('executed');
  s.el.style.border='2px solid #77d287';
  addLog(`TX ${txId} executed in slot ${slotId}`);
}

startBtn.addEventListener('click', ()=> {
  init();
  simulate();
});

init();
