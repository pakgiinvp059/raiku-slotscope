let slots = [];
let txRecords = [];
let totalFee = 0;

const timeline = document.getElementById("timeline");
const log = document.getElementById("log");
const metricsDiv = document.getElementById("metrics");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const scenarioSel = document.getElementById("scenario");
const modeAot = document.getElementById("modeAot");
const txCountInput = document.getElementById("txCount");

let ctx, txChart;

function addLog(t) {
  log.innerHTML = `[${new Date().toLocaleTimeString()}] ${t}<br>` + log.innerHTML;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function initSlots() {
  timeline.innerHTML = "";
  slots = [];
  for (let i = 1; i <= 10; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.id = "slot-" + i;
    el.innerHTML = `
      <div>Slot ${i}</div>
      <div class="stats">
        <div class="badge exec" id="slot-${i}-exec">0</div>
        <div class="badge pending" id="slot-${i}-pend">0</div>
        <div class="badge fail" id="slot-${i}-fail">0</div>
      </div>`;
    timeline.appendChild(el);
    slots.push({
      id: i,
      el,
      counts: { exec: 0, pend: 0, fail: 0 },
      state: "idle",
    });
  }
  txRecords = [];
  totalFee = 0;
  renderMetrics();
  resetChart();
}

function setSlotState(slot, state) {
  slot.el.classList.remove("executed", "failed", "pending");
  if (state !== "idle") slot.el.classList.add(state);
  slot.state = state;
}

function incSlot(slot, type) {
  slot.counts[type]++;
  document.getElementById(`slot-${slot.id}-${type}`).textContent =
    slot.counts[type];
}

function renderMetrics() {
  const executed = txRecords.filter((x) => x.status === "executed").length;
  const failed = txRecords.filter((x) => x.status === "failed").length;
  const total = txRecords.length;
  metricsDiv.innerHTML = `
    <div class="metric"><div class="value">${total}</div><div class="label">Total TX</div></div>
    <div class="metric"><div class="value">${executed}</div><div class="label">Executed</div></div>
    <div class="metric"><div class="value">${failed}</div><div class="label">Failed</div></div>
    <div class="metric"><div class="value">${totalFee.toFixed(
      5
    )}</div><div class="label">Total Fee (SOL)</div></div>
  `;
}

function resetChart() {
  if (!txChart) return;
  txChart.data.labels = [];
  txChart.data.datasets.forEach((d) => (d.data = []));
  txChart.update();
}

function initChart() {
  const canvas = document.getElementById("txChart");
  ctx = canvas.getContext("2d");
  txChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Total", borderColor: "#333", data: [] },
        { label: "Pending", borderColor: "#ffb600", data: [] },
        { label: "Executed", borderColor: "#22bb55", data: [] },
        { label: "Failed", borderColor: "#ff4444", data: [] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 2,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { title: { display: true, text: "Slot (1–10)" } },
        y: { beginAtZero: true, title: { display: true, text: "TX Count" } },
      },
    },
  });
}

function updateChart(slotId, total, executed, failed) {
  txChart.data.labels.push("Slot " + slotId);
  txChart.data.datasets[0].data.push(total);
  txChart.data.datasets[1].data.push(total - executed - failed);
  txChart.data.datasets[2].data.push(executed);
  txChart.data.datasets[3].data.push(failed);
  txChart.update();
}

async function simulate() {
  const totalTx = Number(txCountInput.value);
  const sc = scenarioSel.value;
  const mode = modeAot.checked ? "AOT" : "JIT";

  addLog(`Simulation start (${mode}, ${sc}, TX=${totalTx})`);
  const perSlot = Math.ceil(totalTx / 10);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    setSlotState(slot, "pending");

    let executed = 0,
      failed = 0;
    for (let j = 0; j < perSlot; j++) {
      const success = Math.random() > 0.2;
      if (success) {
        incSlot(slot, "exec");
        executed++;
        totalFee += 0.0001;
      } else {
        incSlot(slot, "fail");
        failed++;
      }
      txRecords.push({
        slot: slot.id,
        status: success ? "executed" : "failed",
      });
    }
    updateChart(slot.id, perSlot, executed, failed);
    renderMetrics();
    setSlotState(slot, executed ? "executed" : failed ? "failed" : "idle");
    await sleep(150);
    setSlotState(slot, "idle");
  }
  addLog("✅ Simulation complete.");
}

startBtn.addEventListener("click", async () => {
  initSlots();
  await simulate();
});
resetBtn.addEventListener("click", initSlots);
exportBtn.addEventListener("click", () => {
  if (!txRecords.length) return alert("No data yet");
  const header = "slot,status\n";
  const csv =
    header +
    txRecords.map((r) => `${r.slot},${r.status}`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "raiku-data.csv";
  a.click();
});

window.onload = () => {
  initSlots();
  initChart();
};
