const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const MOLDURA = new Set([1,2,3,4,5,6,10,11,15,16,20,21,22,23,24,25]);
const MIOLO = new Set([7,8,9,12,13,14,17,18,19]);
const CRUZ = new Set([3,8,11,12,13,14,15,18,23]);
const PRIMOS = new Set([2,3,5,7,11,13,17,19,23]);
const FIB = new Set([1,2,3,5,8,13,21]);
const countIn = (arr, set) => arr.filter(n => set.has(n)).length;
const faixa = s => `${Math.floor(s/10)*10}-${Math.floor(s/10)*10+9}`;
const distList = (counter, total) => Object.entries(counter)
  .map(([chave, qtd]) => ({ chave, qtd, pct: +(qtd * 100 / total).toFixed(1) }))
  .sort((a, b) => b.qtd - a.qtd);
let allDraws = [];
let sourceInfo = {};

function analyse(draws, windowSize) {
  const subset = windowSize ? draws.slice(-windowSize) : draws;
  if (!subset.length) throw new Error("Nenhum concurso encontrado.");
  const last = draws.at(-1);
  const prev = draws.length > 1 ? draws.at(-2) : null;
  const count = subset.length;
  const freq = Array(26).fill(0);
  const lastSeen = Array(26).fill(null);
  const series = Array.from({ length: 26 }, () => []);
  const mm = {}, faixas = {}, somasEx = {}, reps = {}, primos = {}, fibs = {}, cruz = {};
  const sums = [];
  for (let i = 0; i < subset.length; i++) {
    const d = subset[i];
    const set = new Set(d.dezenas);
    const soma = d.dezenas.reduce((a, b) => a + b, 0);
    sums.push(soma);
    somasEx[soma] = (somasEx[soma] || 0) + 1;
    faixas[faixa(soma)] = (faixas[faixa(soma)] || 0) + 1;
    const nMold = countIn(d.dezenas, MOLDURA);
    mm[`${nMold}x${15 - nMold}`] = (mm[`${nMold}x${15 - nMold}`] || 0) + 1;
    primos[countIn(d.dezenas, PRIMOS)] = (primos[countIn(d.dezenas, PRIMOS)] || 0) + 1;
    fibs[countIn(d.dezenas, FIB)] = (fibs[countIn(d.dezenas, FIB)] || 0) + 1;
    cruz[countIn(d.dezenas, CRUZ)] = (cruz[countIn(d.dezenas, CRUZ)] || 0) + 1;
    const idx = draws.findIndex(x => x.concurso === d.concurso);
    if (idx > 0) {
      const r = d.dezenas.filter(n => draws[idx - 1].dezenas.includes(n)).length;
      reps[r] = (reps[r] || 0) + 1;
    }
    for (let n = 1; n <= 25; n++) {
      series[n].push(set.has(n) ? 1 : 0);
      if (set.has(n)) freq[n]++;
    }
  }
  for (const d of draws) d.dezenas.forEach(n => { lastSeen[n] = d.concurso; });
  const numbers = [];
  for (let n = 1; n <= 25; n++) {
    numbers.push({
      n, freq: freq[n], pct: +(freq[n] * 100 / count).toFixed(1),
      atraso: last.concurso - (lastSeen[n] ?? last.concurso),
      spark: series[n].slice(-40)
    });
  }
  const byFreq = [...numbers].sort((a, b) => b.freq - a.freq || a.n - b.n);
  const byDelay = [...numbers].sort((a, b) => b.atraso - a.atraso || a.n - b.n);
  const byLeast = [...numbers].sort((a, b) => a.freq - b.freq || a.n - b.n);
  const lastSet = new Set(last.dezenas);
  const prevSet = new Set(prev ? prev.dezenas : []);
  const repetidas = last.dezenas.filter(n => prevSet.has(n));
  const novas = last.dezenas.filter(n => !prevSet.has(n));
  return {
    total_historico: draws.length,
    concursos_analisados: count,
    dezenas: numbers,
    ultimo: {
      ...last,
      pares: last.dezenas.filter(n => n % 2 === 0).length,
      soma: last.dezenas.reduce((a, b) => a + b, 0),
      moldura: countIn(last.dezenas, MOLDURA)
    },
    mais: byFreq.slice(0, 8),
    menos: byLeast.slice(0, 8),
    atrasadas: byDelay.slice(0, 8),
    mm: distList(mm, count),
    faixas: distList(faixas, count).slice(0, 8),
    somasExatas: distList(somasEx, count).slice(0, 8),
    reps: distList(reps, Object.values(reps).reduce((a, b) => a + b, 0) || 1),
    primos: distList(primos, count),
    fibs: distList(fibs, count),
    cruz: distList(cruz, count),
    soma: { media: +(sums.reduce((a, b) => a + b, 0) / count).toFixed(2), min: Math.min(...sums), max: Math.max(...sums) },
    repetidas,
    novas,
    ultimo_rep: repetidas.length,
    recentes: draws.slice(-14).reverse().map(d => {
      const idx = draws.findIndex(x => x.concurso === d.concurso);
      const rep = idx > 0 ? d.dezenas.filter(n => draws[idx - 1].dezenas.includes(n)).length : "—";
      const soma = d.dezenas.reduce((a, b) => a + b, 0);
      return { ...d, pares: d.dezenas.filter(n => n % 2 === 0).length, soma, faixa: faixa(soma), mold: countIn(d.dezenas, MOLDURA), rep };
    }),
    palpites: makeGuesses(lastSet)
  };
}

function makeGuesses(lastSet) {
  const last = [...lastSet];
  const fora = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !lastSet.has(n));
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)(last.reduce((a, b) => a + b, 0) * 17);
  const pick = (arr, n) => {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return out;
  };
  const profiles = [
    ["Moda 9×6", 9, 9],
    ["10×5", 8, 10],
    ["Repetidas 10", 10, 9],
    ["11×4", 8, 11],
    ["8×7", 10, 8]
  ];
  return profiles.map(([name, nRep, nMold]) => {
    let game = [...pick(last, Math.min(nRep, last.length)), ...pick(fora, 15 - Math.min(nRep, last.length))];
    game = [...new Set(game)].slice(0, 15);
    while (game.length < 15) {
      const extra = pick(Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !game.includes(n)), 1);
      game.push(...extra);
    }
    game.sort((a, b) => a - b);
    const soma = game.reduce((a, b) => a + b, 0);
    return {
      name,
      dezenas: game,
      soma,
      moldura: countIn(game, MOLDURA),
      rep: game.filter(n => lastSet.has(n)).length,
      pares: game.filter(n => n % 2 === 0).length
    };
  });
}

const chips = nums => nums.map(n => `<span class="chip">${pad(n)}</span>`).join("");
const spark = arr => `<div class="spark">${arr.map(v => `<i class="${v ? "on" : ""}" style="height:${v ? 100 : 18}%"></i>`).join("")}</div>`;
const delayClass = v => v <= 2 ? "hot" : v <= 5 ? "warm" : "cold";
const bars = list => {
  const m = Math.max(...list.map(x => x.qtd), 1);
  return list.map(x => `<div class="barrow"><div style="width:64px;font-size:.75rem">${x.chave}</div><div class="bar"><span style="width:${100 * x.qtd / m}%"></span></div><div class="sub" style="width:72px">${x.qtd} · ${x.pct}%</div></div>`).join("");
};

function render(d) {
  $("status").innerHTML = `Fonte: ${sourceInfo.fonte || "—"} · atualizado ${new Date(sourceInfo.atualizado_em).toLocaleString("pt-BR")} · ${d.total_historico} concursos · janela: ${d.concursos_analisados}${sourceInfo.aviso ? ` <span class="err">· ${sourceInfo.aviso}</span>` : ""}`;
  const u = d.ultimo;
  $("cards").innerHTML = [
    ["Último concurso", u.concurso, u.data],
    ["Dezenas", u.dezenas.map(pad).join("  "), `${u.pares} pares · ${15 - u.pares} ímpares`],
    ["Soma / faixa", `${u.soma} · ${faixa(u.soma)}`, `média ${d.soma.media}`],
    ["Moldura / miolo", `${u.moldura} / ${15 - u.moldura}`, d.mm[0] ? `mais visto ${d.mm[0].chave}` : ""],
    ["Repetidas", `${d.ultimo_rep} de 15`, "em relação ao concurso anterior"],
    ["Janela", d.concursos_analisados, `min ${d.soma.min} · máx ${d.soma.max}`]
  ].map(([k, v, s]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("");
  $("balls").innerHTML = d.dezenas.map(x => `<article class="ball ${delayClass(x.atraso)}"><div class="num">${pad(x.n)}</div><div class="meta">freq <b>${x.freq}</b> · ${x.pct}%<br>atraso <b>${x.atraso}</b></div>${spark(x.spark)}</article>`).join("");
  const table = arr => `<table><thead><tr><th>#</th><th>freq.</th><th>atraso</th></tr></thead><tbody>${arr.map(x => `<tr><td>${chips([x.n])}</td><td>${x.freq}</td><td>${x.atraso}</td></tr>`).join("")}</tbody></table>`;
  $("mais").innerHTML = table(d.mais);
  $("menos").innerHTML = table(d.menos);
  $("atraso").innerHTML = table(d.atrasadas);
  let map = '<div class="mini5">';
  for (let n = 1; n <= 25; n++) {
    map += `<div class="c5 ${MOLDURA.has(n) ? "mold" : "miolo"} ${u.dezenas.includes(n) ? "hit" : ""}">${pad(n)}</div>`;
  }
  $("mapaMm").innerHTML = map + "</div>";
  $("mmKpi").innerHTML = `Último ${u.moldura}×${15 - u.moldura} · padrão mais visto: ${d.mm[0] ? `${d.mm[0].chave} (${d.mm[0].pct}%)` : "—"}`;
  $("distMm").innerHTML = bars(d.mm.slice(0, 8));
  $("kpiSoma").innerHTML = `Última ${u.soma} (${faixa(u.soma)}) · min ${d.soma.min} · média ${d.soma.media} · máx ${d.soma.max}`;
  $("faixas").innerHTML = bars(d.faixas);
  $("somasExatas").innerHTML = bars(d.somasExatas);
  $("kpiRep").textContent = `${d.ultimo_rep} de 15`;
  $("repChips").innerHTML = chips(d.repetidas);
  $("novChips").innerHTML = chips(d.novas);
  $("distRep").innerHTML = bars(d.reps);
  $("palpites").innerHTML = d.palpites.map((p, i) => `<div class="pill"><b>${i + 1}. ${p.name}</b><div class="ult">${chips(p.dezenas)}</div><span class="sub">${p.moldura}×${15 - p.moldura} · soma ${p.soma} · ${p.pares}p/${15 - p.pares}i · rep ${p.rep}</span></div>`).join("");
  const group = (title, set, dist, qtd) => `<div class="s">${title}</div><div class="chips-lg">${[...set].sort((a,b)=>a-b).map(n => `<span class="chip${u.dezenas.includes(n) ? "" : ""}" style="${u.dezenas.includes(n) ? "border-color:#3dff9a;color:#3dff9a" : ""}">${pad(n)}</span>`).join("")}</div><div class="s">Último: ${qtd}</div>${bars(dist.slice(0, 8))}`;
  $("primos").innerHTML = group("2 3 5 7 11 13 17 19 23", PRIMOS, d.primos, countIn(u.dezenas, PRIMOS));
  $("fib").innerHTML = group("1 2 3 5 8 13 21", FIB, d.fibs, countIn(u.dezenas, FIB));
  $("cruz").innerHTML = group("linha 11–15 + coluna 3 8 13 18 23", CRUZ, d.cruz, countIn(u.dezenas, CRUZ));
  $("recentes").innerHTML = d.recentes.map(r => `<div class="pill"><b>#${r.concurso}</b> · ${r.data}<div class="ult">${chips(r.dezenas)}</div><span class="sub">${r.pares}/${15 - r.pares} · soma ${r.soma} · ${r.faixa} · ${r.mold}×${15 - r.mold} · rep ${r.rep}</span></div>`).join("");
}

function rerender() {
  render(analyse(allDraws, $("janela").value === "todos" ? null : Number($("janela").value)));
}
async function load(refresh = false) {
  const button = $("btn");
  button.disabled = true;
  button.textContent = refresh ? "Atualizando…" : "Carregando…";
  try {
    const result = await fetch(`/api/lotofacil-data${refresh ? `?t=${Date.now()}` : ""}`);
    const payload = await result.json();
    if (!result.ok || !payload.ok) throw new Error(payload.erro || "Falha ao carregar");
    allDraws = payload.draws;
    sourceInfo = payload;
    rerender();
  } catch (error) {
    $("status").innerHTML = `<span class="err">${error.message} Tente novamente em alguns instantes.</span>`;
  } finally {
    button.disabled = false;
    button.textContent = "Atualizar histórico";
  }
}
$("janela").addEventListener("change", rerender);
$("btn").addEventListener("click", () => load(true));
load();
