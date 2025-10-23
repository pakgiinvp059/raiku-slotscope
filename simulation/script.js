// script.js - simulation logic
document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const slotsContainer = document.getElementById('slots');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const compareBtn = document.getElementById('compareBtn');
  const exportBtn = document.getElementById('exportBtn');
  const autoRunCheckbox = document.getElementById('autoRun');
  const txCountInput = document.getElementById('txCount');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const comparisonBox = document.getElementById('comparisonBox');

  // Summary elements
  const executedEl = document.getElementById('executedTx');
  const failedEl = document.getElementById('failedTx');
  const pendingEl = document.getElementById('pendingTx');
  const jitGasEl = document.getElementById('jitGas');
  const aotGasEl = document.getElementById('aotGas');
  const totalGasEl = document.getElementById('totalGas');

  const jitExecutedEl = document.getElementById('jitExecuted');
  const jitFailedEl = document.getElementById('jitFailed');
  const jitPendingEl = document.getElementById('jitPending');
  const aotExecutedEl = document.getElementById('aotExecuted');
  const aotFailedEl = document.getElementById('aotFailed');
  const aotPendingEl = document.getElementById('aotPending');

  const jitTxCompare = document.getElementById('jitTxCompare');
  const aotTxCompare = document.getElementById('aotTxCompare');
  const jitGasCompare = document.getElementById('jitGasCompare');
  const aotGasCompare = document.getElementById('aotGasCompare');

  // state
  const SLOTS = 10;
  let slotEls = [];
  let mode = 'JIT';
  let cumulative = {
    executed: 0, failed: 0, pending: 0,
    jitGas: 0, aotGas: 0,
    jitExecuted: 0, jitFailed: 0, jitPending: 0,
    aotExecuted: 0, aotFailed: 0, aotPending: 0
  };

  // Create slot DOM elements dynamically (fixes template literal leak)
  function initSlots() {
    slotsContainer.innerHTML = '';
    slotEls = [];
    for (let i=0;i<SLOTS;i++){
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = `<h3>Slot ${i+1}</h3>
        <div class="dots">
          <span class="dot green"></span>
          <span class="dot orange"></span>
          <span class="dot red"></span>
        </div>
        <div class="slot-value" id="slot-val-${i}">0</div>`;
      slotsContainer.appendChild(s);
      slotEls.push(document.getElementById(`slot-val-${i}`));
    }
  }
  initSlots();

  // Mode radio handling
  modeRadios.forEach(r=>r.addEventListener('change', e=>{ if(e.target.checked) mode=e.target.value;}));

  // Charts setup (Chart.js)
  const txCtx = document.getElementById('txChart').getContext('2d');
  const gasCtx = document.getElementById('gasChart').getContext('2d');

  const txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({length:SLOTS}, (_,i)=>`Slot ${i+1}`),
      datasets: [
        {label:'Executed', data:Array(SLOTS).fill(0), borderColor:'#27ae60', pointRadius:3, tension:0.25},
        {label:'Pending', data:Array(SLOTS).fill(0), borderColor:'#f1c40f', pointRadius:3, tension:0.25},
        {label:'Failed', data:Array(SLOTS).fill(0), borderColor:'#e74c3c', pointRadius:3, tension:0.25}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{legend:{display:false}}
    }
  });

  const gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({length:SLOTS}, (_,i)=>`Slot ${i+1}`),
      datasets:[
        {label:'AOT Gas', backgroundColor:'#16a085', data:Array(SLOTS).fill(0)},
        {label:'JIT Gas', backgroundColor:'#2980b9', data:Array(SLOTS).fill(0)}
      ]
    },
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });

  // Random generation but tuned: small gas, executed dominant, pending appears under congestion
  function generateSlotData(scenario){
    // Returns array of {ex, pend, fail, gas}
    const arr = [];
    for (let i=0;i<SLOTS;i++){
      // base executed
      let base = Math.floor(20 + Math.random()*20);
      // scenario effects
      if (scenario==='High Fee') base = Math.floor(40 + Math.random()*30);
      if (scenario==='Congestion') base = Math.floor(10 + Math.random()*30);

      // pending & fail
      const pend = scenario==='Congestion' ? Math.floor(Math.random()*6) : Math.floor(Math.random()*3);
      const fail = Math.random() < 0.05 ? Math.floor(Math.random()*3) : Math.floor(Math.random()*1);

      // gas small: AOT higher than JIT by factor
      const gas = +(0.00003 + Math.random()*0.00008).toFixed(5);
      arr.push({ex:base, pend, fail, gas});
    }
    return arr;
  }

  // Update slot boxes
  function updateSlotBoxes(data){
    data.forEach((d,i)=>{
      slotEls[i].textContent = d.ex + d.pend + d.fail;
    });
  }

  // update charts and cumulative counters
  function applySimulation(data){
    // update chart datasets
    txChart.data.datasets[0].data = data.map(d=>d.ex);
    txChart.data.datasets[1].data = data.map(d=>d.pend);
    txChart.data.datasets[2].data = data.map(d=>d.fail);
    // gas chart: will set for either JIT or AOT depending on mode
    if (mode==='AOT'){
      gasChart.data.datasets[0].data = data.map(d=>d.gas);
      // zero out JIT dataset for visual clarity (keeps 1/4 width relative)
      gasChart.data.datasets[1].data = Array(SLOTS).fill(0);
    } else {
      gasChart.data.datasets[1].data = data.map(d=>d.gas);
      gasChart.data.datasets[0].data = Array(SLOTS).fill(0);
    }
    txChart.update();
    gasChart.update();

    // accumulate sums
    const exSum = data.reduce((s,x)=>s+x.ex,0);
    const pendSum = data.reduce((s,x)=>s+x.pend,0);
    const failSum = data.reduce((s,x)=>s+x.fail,0);
    const gasSum = data.reduce((s,x)=>s+x.gas,0);

    cumulative.executed += exSum;
    cumulative.pending += pendSum;
    cumulative.failed += failSum;

    if (mode==='AOT'){
      cumulative.aotGas += gasSum;
      cumulative.aotExecuted += exSum;
      cumulative.aotPending += pendSum;
      cumulative.aotFailed += failSum;
    } else {
      cumulative.jitGas += gasSum;
      cumulative.jitExecuted += exSum;
      cumulative.jitPending += pendSum;
      cumulative.jitFailed += failSum;
    }

    // reflect to DOM (cumulative)
    executedEl.textContent = cumulative.executed;
    failedEl.textContent = cumulative.failed;
    pendingEl.textContent = cumulative.pending;
    jitGasEl.textContent = cumulative.jitGas.toFixed(5);
    aotGasEl.textContent = cumulative.aotGas.toFixed(5);
    totalGasEl.textContent = (cumulative.jitGas + cumulative.aotGas).toFixed(5);

    jitExecutedEl.textContent = cumulative.jitExecuted;
    jitFailedEl.textContent = cumulative.jitFailed;
    jitPendingEl.textContent = cumulative.jitPending;
    aotExecutedEl.textContent = cumulative.aotExecuted;
    aotFailedEl.textContent = cumulative.aotFailed;
    aotPendingEl.textContent = cumulative.aotPending;
  }

  // simulate once with slight staged delay for realism
  async function simulateOnce() {
    const scenario = document.getElementById('scenario').value;
    const txCount = Number(txCountInput.value) || 100;

    // generate slot-level distribution scaled by txCount / sumBase
    let baseArr = generateSlotData(scenario); // ex/pend/fail/gas per slot
    // scale to TX Count proportionally to each slot's base ex
    const baseSum = baseArr.reduce((s,x)=>s+x.ex,0);
    const scale = txCount / baseSum;

    const scaled = baseArr.map(s=>{
      const ex = Math.max(0, Math.round(s.ex * scale));
      const pend = s.pend; // keep small randomness
      const fail = s.fail;
      const gas = +(s.gas).toFixed(5);
      return { ex, pend, fail, gas };
    });

    // update UI progressively (simulate slot-by-slot processing)
    for (let i=0;i<SLOTS;i++){
      // small delay to show activity
      await new Promise(res => setTimeout(res, 80 + Math.random()*120));
      // per-slot visual update (we'll push temporary one-slot arrays to chart for moment)
      // update slot count
      slotEls[i].textContent = scaled[i].ex + scaled[i].pend + scaled[i].fail;

      // update charts with current cumulative per-slot view: show full final arrays after loop
      // (for light animation, we can update a temporary dataset showing partial progress)
      const partialEx = txChart.data.datasets[0].data.slice();
      const partialPend = txChart.data.datasets[1].data.slice();
      const partialFail = txChart.data.datasets[2].data.slice();
      partialEx[i] = scaled[i].ex;
      partialPend[i] = scaled[i].pend;
      partialFail[i] = scaled[i].fail;
      txChart.data.datasets[0].data = partialEx;
      txChart.data.datasets[1].data = partialPend;
      txChart.data.datasets[2].data = partialFail;

      // gas update for slot
      const gasEx = gasChart.data.datasets[ mode==='AOT' ? 0 : 1 ].data.slice();
      gasEx[i] = scaled[i].gas;
      if (mode==='AOT'){
        gasChart.data.datasets[0].data = gasEx;
      } else {
        gasChart.data.datasets[1].data = gasEx;
      }

      txChart.update('none');
      gasChart.update('none');
    }

    // after loop, apply full scaled values cumulatively
    updateSlotBoxes(scaled);
    applySimulation(scaled);
  }

  // start handling including auto-run 5 rounds with confirmation
  startBtn.addEventListener('click', async () => {
    // run a single simulation
    await simulateOnce();

    if (autoRunCheckbox.checked) {
      let rounds = 4; // already ran 1, run 4 more = total 5
      const interval = setInterval(async () => {
        if (rounds <= 0) {
          clearInterval(interval);
          // after 5 rounds ask confirmation to continue
          const cont = confirm('Auto-run finished 5 rounds. Continue auto-run?');
          if (cont) {
            // run another 5 rounds automatically
            startBtn.click(); // triggers again; user can uncheck auto to stop
          } else {
            autoRunCheckbox.checked = false;
          }
          return;
        }
        await simulateOnce();
        rounds--;
      }, 900); // pace
    }
  });

  resetBtn.addEventListener('click', () => {
    // reset cumulative state + UI
    cumulative = {
      executed: 0, failed: 0, pending: 0,
      jitGas: 0, aotGas: 0,
      jitExecuted: 0, jitFailed: 0, jitPending: 0,
      aotExecuted: 0, aotFailed: 0, aotPending: 0
    };
    slotEls.forEach(el => el.textContent = '0');
    txChart.data.datasets.forEach(ds => ds.data = Array(SLOTS).fill(0));
    gasChart.data.datasets.forEach(ds => ds.data = Array(SLOTS).fill(0));
    txChart.update(); gasChart.update();
    executedEl.textContent = failedEl.textContent = pendingEl.textContent = 0;
    jitGasEl.textContent = aotGasEl.textContent = totalGasEl.textContent = '0.00000';
    jitExecutedEl.textContent = jitFailedEl.textContent = jitPendingEl.textContent = 0;
    aotExecutedEl.textContent = aotFailedEl.textContent = aotPendingEl.textContent = 0;
    comparisonBox.classList.add('hidden');
  });

  // compare panel toggle
  compareBtn.addEventListener('click', () => {
    comparisonBox.classList.toggle('hidden');
    // set comparison values
    jitTxCompare.textContent = cumulative.jitExecuted + cumulative.jitPending + cumulative.jitFailed;
    aotTxCompare.textContent = cumulative.aotExecuted + cumulative.aotPending + cumulative.aotFailed;
    jitGasCompare.textContent = cumulative.jitGas.toFixed(5);
    aotGasCompare.textContent = cumulative.aotGas.toFixed(5);
  });

  // export CSV (simple snapshot of per-slot and cumulative)
  exportBtn.addEventListener('click', () => {
    const rows = [];
    rows.push(['Slot','Executed','Pending','Failed','AOT Gas','JIT Gas']);
    // capture latest chart data (per-slot)
    for (let i=0;i<SLOTS;i++){
      const ex = txChart.data.datasets[0].data[i] || 0;
      const pend = txChart.data.datasets[1].data[i] || 0;
      const fail = txChart.data.datasets[2].data[i] || 0;
      const aotGas = gasChart.data.datasets[0].data[i] || 0;
      const jitGas = gasChart.data.datasets[1].data[i] || 0;
      rows.push([`Slot ${i+1}`,ex,pend,fail,aotGas,jitGas]);
    }
    rows.push([]);
    rows.push(['Cumulative Executed', cumulative.executed]);
    rows.push(['Cumulative Pending', cumulative.pending]);
    rows.push(['Cumulative Failed', cumulative.failed]);
    rows.push(['JIT Gas', cumulative.jitGas.toFixed(5)]);
    rows.push(['AOT Gas', cumulative.aotGas.toFixed(5)]);
    // CSV construct
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'raiku-snapshot.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  // initialize UI sizes and first render (empty)
  txChart.update(); gasChart.update();
});
