function run(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);
  const base = Math.floor(totalTX / 10);
  const rem = totalTX % 10;
  const perGate = Array.from({ length: 10 }, (_, i) => base + (i < rem ? 1 : 0));

  let runExec = 0, runFail = 0, runPend = 0, runGas = 0;

  for (let i = 0; i < 10; i++) {
    const txCount = perGate[i];
    // --- chính xác hóa phân bổ ---
    let pendCount = Math.round(txCount * rates.pend);
    let failCount = Math.round(txCount * rates.fail);
    let execCount = Math.round(txCount * rates.exec);

    let calc = execCount + pendCount + failCount;
    if (calc < txCount) execCount += (txCount - calc);
    else if (calc > txCount) execCount -= (calc - txCount);

    const gate = document.getElementById(`slot-${i+1}`);
    gate.querySelector('.exec').textContent = '0';
    gate.querySelector('.pend').textContent = pendCount;
    gate.querySelector('.fail').textContent = '0';

    cumPend += pendCount;
    runPend += pendCount;
    txChart.data.datasets[1].data[i] = pendCount;

    const sequence = [...Array(execCount).fill('E'), ...Array(failCount).fill('F')];
    for (let s = sequence.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      [sequence[s], sequence[r]] = [sequence[r], sequence[s]];
    }

    sequence.forEach((tx, idx) => {
      const step = randomBetween(80, 160);
      const delay = i * 30;
      setTimeout(() => {
        let pNow = parseInt(gate.querySelector('.pend').textContent, 10);
        if (pNow > 0) {
          pNow--;
          gate.querySelector('.pend').textContent = pNow;
          txChart.data.datasets[1].data[i] = pNow;
          cumPend--; runPend--;
        }

        if (tx === 'E') {
          const eNow = +gate.querySelector('.exec').textContent + 1;
          gate.querySelector('.exec').textContent = eNow;
          txChart.data.datasets[0].data[i] = eNow;
          cumExec++; runExec++;
          const g = mode === 'AOT' ? randomGas(0.00005, 0.00008) : randomGas(0.00002, 0.00005);
          runGas += g;
          if (mode === 'AOT') { cumGasAOT += g; gasChart.data.datasets[0].data[i] += g; }
          else { cumGasJIT += g; gasChart.data.datasets[1].data[i] += g; }
        } else {
          const fNow = +gate.querySelector('.fail').textContent + 1;
          gate.querySelector('.fail').textContent = fNow;
          txChart.data.datasets[2].data[i] = fNow;
          cumFail++; runFail++;
        }

        txChart.update('none');
        gasChart.update('none');
        updateStats();
      }, idx * step + delay);
    });
  }

  // snapshot
  setTimeout(() => {
    snapshots[mode] = { exec: runExec, pend: runPend, fail: runFail, gas: runGas };
  }, 4000);
}
