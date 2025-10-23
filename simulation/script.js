const SLOT_COUNT = 10;
let perSlot = [];
let totals = { exec: 0, fail: 0, pend: 0, gasAOT: 0, gasJIT: 0 };
let txChart, gasChart;
let autoTimer = null;
let autoRuns = 0;

const slotsRow = document.getElementById("slotsRow");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSel = document.getElementById("scenario");
const autorunChk = document.getElementById("autorun");
const jitMode = document.getElementById("jitMode");
const aotMode = document.getElementById("aotMode");

const execEl = document.querySelector("#executedCnt strong");
const failEl = document.querySelector("#failedCnt strong");
const pendEl = document.querySelector("#pendingCnt strong");
const aotGasEl = document.querySelector("#aotGas strong");
const jitGasEl = document.querySelector("#jitGas strong");
const totalGasEl = document.querySelector("#totalGas strong");

function initSlots() {
  slotsRow.innerHTML = "";
  perSlot = Array.from({ length: SLOT_COUNT }, () => ({
    exec: 0,
    pend: 0,
    fail: 0,
    gasAOT: 0,
    gasJIT: 0,
  }));
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = document.createElement("div");
    s.className = "slot";
    s.innerHTML = `
      <h4>Slot ${i + 1}</h4>
      <div class="dots">
        <div class="dot green"></div>
        <div class="dot yellow"></div>
        <div class="dot red"></div>
      </div>
      <div class="slot-stats" id="slotstat-${i}">
        <span class="green-txt">0</span> /
        <span class="yellow-txt">0</span> /
        <span class="red-txt">0</span>
      </div>`;
    slotsRow.appendChild(s);
  }
}

function createCharts() {
  const txCtx = document.getElementById("txChart");
  const gasCtx = document.getElementById("gasChart");
  const labels = Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`);

  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Executed", borderColor: "#10b981", data: [], tension: 0.3, pointRadius: 3 },
        { label: "Pending", borderColor: "#f59e0b", data: [], tension: 0.3, pointRadius: 3 },
        { label: "Failed", borderColor: "#ef4444", data: [], tension: 0.3, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }, // ❌ tắt chú thích trên
      animation: { duration: 600, easing: "easeOutQuart" },
    },
  });

  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "AOT Gas", backgroundColor: "#10b981", data: [] },
        { label: "JIT Gas", backgroundColor: "#3b82f6", data: [] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      animation: { duration: 600 },
    },
  });
}

function simulateOnce() {
  const txCount = parseInt(txCountInput.value) || 100;
  const scenario = scenarioSel.value;
  const isAOT = aotMode.checked;
  let pFail = 0.02,
    pPend = 0.03,
    gA = 0.0015,
    gJ = 0.001;

  if (scenario === "high") {
    pFail = 0.05;
    pPend = 0.04;
  } else if (scenario === "congested") {
    pFail = 0.1;
    pPend = 0.08;
  }

  if (isAOT) {
    pPend *= 0.25;
    pFail *= 0.4;
    gA *= 3;
  }

  let delay = 0;
  for (let i = 0; i < txCount; i++) {
    setTimeout(() => {
      const idx = Math.floor(Math.random() * SLOT_COUNT);
      const r = Math.random();
      if (r < pFail) {
        perSlot[idx].fail++;
        totals.fail++;
      } else if (r < pFail + pPend) {
        perSlot[idx].pend++;
        totals.pend++;
      } else {
        perSlot[idx].exec++;
        totals.exec++;
      }

      const gas = (isAOT ? gA : gJ) * (1 + Math.random() * 0.4);
      if (isAOT) {
        perSlot[idx].gasAOT += gas;
        totals.gasAOT += gas;
      } else {
        perSlot[idx].gasJIT += gas;
        totals.gasJIT += gas;
      }

      updateCharts();
      updateUI();
    }, delay);
    delay += 2;
  }
}

function updateCharts() {
  const execArr = [],
    pendArr = [],
    failArr = [],
    gasA = [],
    gasJ = [];
  perSlot.forEach((s) => {
    execArr.push(s.exec);
    pendArr.push(s.pend);
    failArr.push(s.fail);
    gasA.push(s.gasAOT);
    gasJ.push(s.gasJIT);
  });
  txChart.data.datasets[0].data = execArr;
  txChart.data.datasets[1].data = pendArr;
  txChart.data.datasets[2].data = failArr;
  gasChart.data.datasets[0].data = gasA;
  gasChart.data.datasets[1].data = gasJ;
  txChart.update();
  gasChart.update();
}

function updateUI() {
  perSlot.forEach((s, i) => {
    const el = document.getElementById(`slotstat-${i}`);
    el.innerHTML = `
      <span class="green-txt">${s.exec}</span> /
      <span class="yellow-txt">${s.pend}</span> /
      <span class="red-txt">${s.fail}</span>`;
  });
  execEl.textContent = totals.exec;
  failEl.textContent = totals.fail;
  pendEl.textContent = totals.pend;
  aotGasEl.textContent = totals.gasAOT.toFixed(4);
  jitGasEl.textContent = totals.gasJIT.toFixed(4);
  totalGasEl.textContent = (totals.gasAOT + totals.gasJIT).toFixed(4);
}

function startAutoRun() {
  if (autoTimer) clearInterval(autoTimer);
  autoRuns = 0;
  autoTimer = setInterval(() => {
    simulateOnce();
    autoRuns++;
    if (autoRuns >= 5) {
      clearInterval(autoTimer);
      setTimeout(() => {
        const cont = confirm("Auto-run đã chạy 5 lần. Bạn có muốn tiếp tục không?");
        if (cont) startAutoRun();
      }, 800);
    }
  }, 1500);
}

startBtn.addEventListener("click", () => {
  if (autorunChk.checked) {
    startAutoRun();
  } else {
    simulateOnce();
  }
});

resetBtn.addEventListener("click", () => {
  totals = { exec: 0, fail: 0, pend: 0, gasAOT: 0, gasJIT: 0 };
  initSlots();
  updateCharts();
  updateUI();
  if (autoTimer) clearInterval(autoTimer);
});

exportBtn.addEventListener("click", () => {
  let csv = "Slot,Executed,Pending,Failed,AOT Gas,JIT Gas\n";
  perSlot.forEach(
    (s, i) =>
      (csv += `${i + 1},${s.exec},${s.pend},${s.fail},${s.gasAOT.toFixed(
        6
      )},${s.gasJIT.toFixed(6)}\n`)
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "slotscope.csv";
  a.click();
});

initSlots();
createCharts();
updateCharts();
updateUI();
