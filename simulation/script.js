let slots = [];
let txRecords = [];

const timeline = document.getElementById("timeline");
const log = document.getElementById("log");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const modeAot = document.getElementById("modeAot");
const txCountInput = document.getElementById("txCount");
const scenarioSel = document.getElementById("scenario");
const autoRun = document.getElementById("autoRun");

let txChart, ctx;

function addLog(msg) {
  log.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + log.innerHTML;
}

function initSlots() {
  timeline.innerHTML = "";
  slots = [];
  for (let i = 1; i <= 10; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.innerHTML = `
      <div>Slot ${i}</div>
      <div class="stats">
        <span class="badge exec" id="slot-${i}-exec">0</span>
        <span class="badge pending" id="slot-${i}-pend">0</span>
        <span class="badge fail" id="slot-${i}-fail">0</span>
      </div>`;
    timeline.appendChild(el);
    slots.push({ id: i, el, counts: { exec: 0, pend: 0, fail: 0 } });
  }
}

function setSlotState(slot, state) {
  slot.el.classList.remove("executed", "failed", "pending");
  if (state !== "idle") slot.el.classList.add(state);
}

function initChart() {
  ctx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Total TX", borderColor: "#333", data: [] },
        { label: "Pending TX", borderColor: "#ffb600", data: [] },
        { label: "Executed TX", borderColor: "#22bb55", data: [] },
        { label: "Failed TX", borderColor: "#ff4444", data: [] },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { title: { display: true, text: "Slot (1–10)" } },
        y: { title: { display: true, text: "Transaction Count" }, beginAtZero: true },
      },
    },
  });
}

function updateChart(slot, total, exec, fail) {
  txChart.data.labels.push("Slot " + slot);
  txChart.data.datasets[0].data.push(total);
  txChart.data.datasets[1].data.push(total - exec - fail);
  txChart.data.datasets[2].data.push(exec);
  txChart.data.datasets[3].data.push(fail);
  txChart.update();
}

async function simulate() {
  const mode = modeAot.checked ? "AOT" : "JIT";
  const txCount = Number(txCountInput.value);
  const perSlot = Math.ceil(txCount / 10);

  addLog(`Simulation started (${mode}) — ${txCount} TX`);

  for (let slot of slots) {
    setSlotState(slot, "pending");
    let exec = 0, fail = 0;

    for (let i = 0; i < perSlot; i++) {
      const chance = mode === "AOT" ? 0.9 : 0.7;
      const success = Math.random() < chance;
      if (success) {
        exec++;
        slot.counts.exec++;
      } else {
        fail++;
        slot.counts.fail++;
      }
    }

    document.getElementById(`slot-${slot.id}-exec`).textContent = slot.counts.exec;
    document.getElementById(`slot-${slot.id}-fail`).textContent = slot.counts.fail;
    document.getElementById(`slot-${slot.id}-pend`).textContent = 0;

    updateChart(slot.id, perSlot, exec, fail);
    setSlotState(slot, exec > 0 ? "executed" : "failed");

    await new Promise((r) => setTimeout(r, 200));
    setSlotState(slot, "idle");
  }

  addLog("✅ Simulation complete.");
}

startBtn.onclick = simulate;
resetBtn.onclick = () => {
  initSlots();
  txChart.destroy();
  initChart();
  addLog("🔄 Reset complete.");
};

window.onload = () => {
  initSlots();
  initChart();
  if (autoRun.checked) simulate();
};
