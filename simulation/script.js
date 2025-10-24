const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');

let txChart, gasChart, compareChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let runCount = 0;
let modeData = { JIT: [], AOT: [] };

for (let i = 1; i <= 10; i++) {
  const s = document.createElement('div');
  s.className = 'slot';
  s.id = `slot-${i}`;
  s.innerHTML = `
    <b>Slot ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div class="slot-values">
      <span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span>
    </div>`;
  slotsContainer.appendChild(s);
}

function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { borderColor: '#22c55e', data: [], fill: false, tension: 0.3 }, // Executed
        { borderColor: '#facc15', data: [], fill: false, tension: 0.3 }, // Pending
        { borderColor: '#ef4444', data: [], fill: false, tension: 0.3 }  // Failed
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  const gasCtx = document.getElementById('gasChart').getContext('2d');
  gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'AOT Gas', backgroundColor: '#00c853', data: Array(10).fill(0) },
        { label: 'JIT Gas', backgroundColor: '#2979ff', data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: (val) => val.toFixed(6) } } }
    }
  });
}
initCharts();

function updateStats(execArr, pendArr, failArr, gasAOT, gasJIT, mode) {
  const execSum = execArr.reduce((a, b) => a + b, 0);
  const pendSum = pendArr.reduce((a, b) => a + b, 0);
  const failSum = failArr.reduce((a, b) => a + b, 0);
  const gasAOTSum = gasAOT.reduce((a, b) => a + b, 0);
  const gasJITSum = gasJIT.reduce((a, b) => a + b, 0);

  // Cộng dồn chính xác
  totalExec += execSum;
  totalPend += pendSum;
  totalFail += failSum;
  totalGasAOT += gasAOTSum;
  totalGasJIT += gasJITSum;
  runCount++;

  // Cập nhật biểu đồ TX
  txChart.data.datasets[0].data = execArr;
  txChart.data.datasets[1].data = pendArr;
  txChart.data.datasets[2].data = failArr;
  txChart.update();

  // Giữ dữ liệu gas cả 2 mode
  for (let i = 0; i < 10; i++) {
    if (mode === 'AOT') gasChart.data.datasets[0].data[i] = gasAOT[i];
    if (mode === 'JIT') gasChart.data.datasets[1].data[i] = gasJIT[i];
  }
  gasChart.update();

  // Cập nhật hiển thị
  document.getElementById("executedVal").innerText = totalExec;
  document.getElementById("failedVal").innerText = totalFail;
  document.getElementById("pendingVal").innerText = totalPend;
  document.getElementById("jitGasVal").innerText = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").innerText = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").innerText = (totalGasAOT + totalGasJIT).toFixed(6);

  modeData[mode].push({
    exec: execSum, pend: pendSum, fail: failSum,
    gasAOT: gasAOTSum, gasJIT: gasJITSum
  });
}

startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const totalTX = parseInt(txCountInput.value) || 100;
  const perSlot = Math.floor(totalTX / 10);
  const remainder = totalTX % 10;
  const execArr = [], pendArr = [], failArr = [], gasAOT = [], gasJIT = [];

  for (let i = 0; i < 10; i++) {
    const base = perSlot + (i < remainder ? 1 : 0);
    const exec = Math.floor(base * 0.9);
    const pend = Math.floor(base * 0.07);
    const fail = base - exec - pend;
    execArr.push(exec);
    pendArr.push(pend);
    failArr.push(fail);
    gasAOT.push(mode === 'AOT' ? +(Math.random() * 0.00005).toFixed(6) : gasChart.data.datasets[0].data[i]);
    gasJIT.push(mode === 'JIT' ? +(Math.random() * 0.00005).toFixed(6) : gasChart.data.datasets[1].data[i]);
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector('.exec').textContent = exec;
    slot.querySelector('.pend').textContent = pend;
    slot.querySelector('.fail').textContent = fail;
  }

  updateStats(execArr, pendArr, failArr, gasAOT, gasJIT, mode);
});

resetBtn.addEventListener('click', () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  runCount = 0;
  modeData = { JIT: [], AOT: [] };
  document.getElementById("executedVal").innerText = 0;
  document.getElementById("failedVal").innerText = 0;
  document.getElementById("pendingVal").innerText = 0;
  document.getElementById("jitGasVal").innerText = "0.00000";
  document.getElementById("aotGasVal").innerText = "0.00000";
  document.getElementById("totalGasVal").innerText = "0.00000";
  txChart.data.datasets.forEach(ds => ds.data = []);
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  if (compareChart) compareChart.destroy();
});

compareBtn.addEventListener('click', () => {
  const avg = (arr, key) => arr.length ? arr.reduce((a,b)=>a+b[key],0)/arr.length : 0;
  const avgJIT = {
    exec: avg(modeData.JIT,'exec'), pend: avg(modeData.JIT,'pend'),
    fail: avg(modeData.JIT,'fail'), gas: avg(modeData.JIT,'gasJIT')
  };
  const avgAOT = {
    exec: avg(modeData.AOT,'exec'), pend: avg(modeData.AOT,'pend'),
    fail: avg(modeData.AOT,'fail'), gas: avg(modeData.AOT,'gasAOT')
  };

  if (compareChart) compareChart.destroy();
  const ctx = document.createElement('canvas');
  ctx.id = 'compareChart';
  document.querySelector('.stats').after(ctx);

  compareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Executed TX', 'Pending TX', 'Failed TX', 'Gas (SOL)'],
      datasets: [
        { label: 'JIT', backgroundColor: '#2979ff', data: [avgJIT.exec, avgJIT.pend, avgJIT.fail, avgJIT.gas] },
        { label: 'AOT', backgroundColor: '#00c853', data: [avgAOT.exec, avgAOT.pend, avgAOT.fail, avgAOT.gas] }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });

  const pendImprove = avgJIT.pend ? ((avgJIT.pend - avgAOT.pend) / avgJIT.pend * 100).toFixed(1) : 0;
  const failImprove = avgJIT.fail ? ((avgJIT.fail - avgAOT.fail) / avgJIT.fail * 100).toFixed(1) : 0;
  const gasIncrease = avgJIT.gas ? ((avgAOT.gas - avgJIT.gas) / avgJIT.gas * 100).toFixed(1) : 0;

  const info = document.createElement('div');
  info.className = 'compare-info';
  info.innerHTML = `
    <p>💡 <b>AOT</b> giảm lỗi <b>${pendImprove}% Pending</b> và <b>${failImprove}% Failed</b> so với JIT.</p>
    <p>⚙️ Gas của AOT tăng nhẹ khoảng <b>${gasIncrease}%</b> để đạt độ ổn định cao hơn.</p>
  `;
  document.body.appendChild(info);
});
