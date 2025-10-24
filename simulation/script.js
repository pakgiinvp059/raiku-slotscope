const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart;

// Tạo slot
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

// Biểu đồ
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', borderColor: '#00c853', data: [], fill: false, tension: 0.25 },
        { label: 'Pending', borderColor: '#facc15', data: [], fill: false, tension: 0.25 },
        { label: 'Failed', borderColor: '#ef4444', data: [], fill: false, tension: 0.25 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const gasCtx = document.getElementById('gasChart').getContext('2d');
  gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'AOT Gas', backgroundColor: '#00c853', data: [] },
        { label: 'JIT Gas', backgroundColor: '#2979ff', data: [] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
initCharts();

// Chạy mô phỏng
startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const txCount = Number(txCountInput.value) || 100;
  const slots = Array.from({ length: 10 }, () => Math.floor(Math.random() * 15) + 5);

  const execArr = [], pendArr = [], failArr = [], gasAOT = [], gasJIT = [];
  let totalExec = 0, totalPend = 0, totalFail = 0;

  for (let i = 0; i < 10; i++) {
    const total = slots[i];
    const exec = Math.floor(total * 0.8);
    const pend = Math.floor(total * 0.15);
    const fail = total - exec - pend;
    execArr.push(exec); pendArr.push(pend); failArr.push(fail);
    totalExec += exec; totalPend += pend; totalFail += fail;
    gasAOT.push(mode === 'AOT' ? +(Math.random() * 0.00005).toFixed(5) : 0);
    gasJIT.push(mode === 'JIT' ? +(Math.random() * 0.00005).toFixed(5) : 0);
  }

  for (let i = 0; i < 10; i++) {
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector('.exec').textContent = execArr[i];
    slot.querySelector('.pend').textContent = pendArr[i];
    slot.querySelector('.fail').textContent = failArr[i];
  }

  txChart.data.datasets[0].data = execArr;
  txChart.data.datasets[1].data = pendArr;
  txChart.data.datasets[2].data = failArr;
  txChart.update();

  gasChart.data.datasets[0].data = gasAOT;
  gasChart.data.datasets[1].data = gasJIT;
  gasChart.update();

  document.getElementById("executedVal").innerText = totalExec;
  document.getElementById("failedVal").innerText = totalFail;
  document.getElementById("pendingVal").innerText = totalPend;
  const aotSum = gasAOT.reduce((a, b) => a + b, 0).toFixed(5);
  const jitSum = gasJIT.reduce((a, b) => a + b, 0).toFixed(5);
  document.getElementById("jitGasVal").innerText = jitSum;
  document.getElementById("aotGasVal").innerText = aotSum;
  document.getElementById("totalGasVal").innerText = (+aotSum + +jitSum).toFixed(5);
});

// Reset
resetBtn.addEventListener('click', () => location.reload());
