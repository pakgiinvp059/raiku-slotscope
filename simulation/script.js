// Raiku SlotScope - Rich simulation: full 10+ TX, per-tx results, export CSV
const timeline = document.getElementById('timeline');
const log = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const modeAot = document.getElementById('modeAot');
const txCountInput = document.getElementById('txCount');
const autorun = document.getElementById('autorun');
const exportBtn = document.getElementById('exportBtn');
const metricsDiv = document.getElementById('metrics');

let slots = [];
let txRecords = []; // {id, slot, status, time, detail}

function initSlots(slotCount = 10){
  timeline.innerHTML = '';
  slots = [];
  for(let i=1;i<=slotCount;i++){
    const el = document.createElement('div');
    el.className = 'slot idle';
    el.id = `slot-${i}`;
    el.innerHTML = `<div>Slot<br>${i}</div>`;
    timeline.appendChild(el);
    slots.push({id:i, el, state:'idle', tx:null});
  }
  txRecords = [];
  renderMetrics();
  addLog(`Ready. Slots: ${slotCount}`, 'ℹ️');
}

function addLog(text, emoji='') {
  const t = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `[${t}] ${text}`;
  log.prepend(line);
}

function renderMetrics(){
  metricsDiv.innerHTML = '';
  const executed = txRecords.filter(t=>t.status==='executed').length;
  const failed = txRecords.filter(t=>t.status==='failed').length;
  const pending = txRecords.filter(t=>t.status==='pending').length;
  const total = txRecords.length;
  const createMetric = (label, value) => `<div class="metric"><div class="value">${value}</div><div class="label">${label}</div></div>`;
  metricsDiv.innerHTML = createMetric('Executed', executed) + createMetric('Failed', failed) + createMetric('Pending', pending) + createMetric('Total TX', total);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function simulate(){
  const txCount = Math.max(1, Math.min(50, Number(txCountInput.value || 10)));
  addLog(`Simulation started. Mode: ${modeAot.checked ? 'AOT' : 'JIT'}`, '🚀');

  // generate txs
  const txs = Array.from({length: txCount}, (_, i) => ({ id: i+1, prefer: modeAot.checked ? ((i % slots.length) + 1) : null }));

  // if AOT: reserve first (or selected) slots
  if(modeAot.checked){
    for(const tx of txs){
      const s = slots.find(x => x.id === tx.prefer && x.state === 'idle');
      if(s){
        s.state = 'reserved';
        s.tx = tx.id;
        s.el.classList.add('reserved');
        txRecords.push({id:tx.id, slot:s.id, status:'reserved', time:new Date().toISOString(), detail:'Reserved AOT'});
        addLog(`TX ${tx.id} reserved slot ${s.id} (AOT)`);
        await sleep(160);
      } else {
        // fallback if no idle slot
        addLog(`TX ${tx.id} could not reserve (no idle slot)`, '⚠️');
        txRecords.push({id:tx.id, slot:null, status:'pending', time:new Date().toISOString(), detail:'Reserve failed'});
      }
    }
    // execute in slot order
    for(const s of slots){
      await sleep(220);
      if(s.state === 'reserved'){
        await executeTx(s.tx, s.id);
      }
    }
  } else {
    // JIT: submit txs sequentially, occupy next idle slot
    for(const tx of txs){
      await sleep(140);
      const s = slots.find(x => x.state === 'idle');
      if(s){
        s.state = 'pending';
        s.tx = tx.id;
        s.el.style.border = '2px dashed #ffa1d0';
        addLog(`TX ${tx.id} submitted → waiting for slot ${s.id}`);
        txRecords.push({id:tx.id, slot:s.id, status:'pending', time:new Date().toISOString(), detail:'Submitted JIT'});
        await sleep(180 + Math.random()*400);
        // randomness to success/fail
        const willSucceed = Math.random() > 0.08; // 92% success default
        if(willSucceed){
          await executeTx(tx.id, s.id);
        } else {
          // fail: drop
          s.state = 'idle';
          s.tx = null;
          s.el.classList.remove('reserved');
          s.el.classList.remove('executed');
          s.el.classList.add('idle');
          s.el.style.border = '';
          addLog(`TX ${tx.id} dropped at slot ${s.id}`, '❌');
          txRecords = txRecords.map(r => r.id === tx.id ? {...r, status:'failed', detail:'Dropped due to congestion'} : r);
          renderMetrics();
        }
      } else {
        addLog(`TX ${tx.id} dropped: no free slot`, '❌');
        txRecords.push({id:tx.id, slot:null, status:'failed', time:new Date().toISOString(), detail:'No slot'});
        renderMetrics();
      }
    }
  }

  // final summary
  await sleep(300);
  const executed = txRecords.filter(t=>t.status==='executed').length;
  addLog(`Simulation complete: ${executed}/${txs.length} executed.`);
  renderMetrics();
}

// executeTx: mark slot executed and record
async function executeTx(txId, slotId){
  const s = slots.find(x=>x.id === slotId);
  if(!s) return;
  s.state = 'executed';
  s.tx = txId;
  s.el.classList.remove('reserved');
  s.el.classList.add('executed');
  s.el.style.border = '2px solid rgba(76,211,122,0.8)';
  addLog(`TX ${txId} executed in slot ${slotId}`, '✅');
  // update txRecords
  const recIndex = txRecords.findIndex(r=>r.id === txId);
  if(recIndex >= 0){
    txRecords[recIndex] = {...txRecords[recIndex], status:'executed', detail:'Included', time:new Date().toISOString()};
  } else {
    txRecords.push({id:txId, slot:slotId, status:'executed', time:new Date().toISOString(), detail:'Included'});
  }
  renderMetrics();
}

// export csv
function exportCSV(){
  if(txRecords.length===0){ alert('No TX records yet'); return; }
  const header = 'txId,slot,status,time,detail\n';
  const rows = txRecords.map(r => `${r.id},${r.slot||''},${r.status},${r.time},${(r.detail||'').replace(',',' ')}`).join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'raiku-slotscope-tx-records.csv';
  a.click();
  URL.revokeObjectURL(url);
}

startBtn.addEventListener('click', async ()=>{
  const count = Math.max(1, Math.min(50, Number(txCountInput.value || 10)));
  // reset slots to chosen number (grid is fixed to 10 cols but we can create count slots visually)
  initSlots(10);
  txRecords = [];
  renderMetrics();
  await simulate();
});

exportBtn.addEventListener('click', exportCSV);

// auto-run on load?
window.addEventListener('load', ()=>{
  initSlots(10);
  if(autorun.checked){
    startBtn.click();
  }
});

// initial
initSlots(10);
