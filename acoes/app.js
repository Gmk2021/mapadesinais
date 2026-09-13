const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  setor: "todos",
  vista: "lista",
  q: "",
};

function fmtNum(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " bi";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " mi";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".", ",") + " mil";
  return String(n);
}

function clsChg(n) {
  if (n === null || n === undefined) return "flat";
  if (n > 0.02) return "up";
  if (n < -0.02) return "down";
  return "flat";
}

function sign(n) {
  if (n === null || n === undefined) return "—";
  const s = n > 0 ? "+" : "";
  return s + fmtNum(n) + "%";
}

function heatColor(pct) {
  if (pct > 1.2) return "rgba(61,255,154,0.22)";
  if (pct > 0.2) return "rgba(61,255,154,0.10)";
  if (pct < -1.2) return "rgba(255,93,115,0.22)";
  if (pct < -0.2) return "rgba(255,93,115,0.10)";
  return "rgba(139,151,171,0.08)";
}

function scoreColor(s) {
  if (s >= 68) return "#3dff9a";
  if (s <= 32) return "#ff5d73";
  return "#ffc14a";
}

function spark(values) {
  if (!values || values.length < 2) return "";
  const w = 92, h = 28, p = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = p + (i * (w - p * 2)) / (values.length - 1);
    const y = h - p - ((v - min) / span) * (h - p * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = values[values.length - 1] >= values[0];
  const color = up ? "#3dff9a" : "#ff5d73";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.6" points="${pts.join(" ")}"/></svg>`;
}

function indice(data, ticker) {
  return (data.indices || []).find((i) => i.ticker === ticker || i.yahoo === ticker);
}

function renderKpis(data) {
  const items = [
    indice(data, "^BVSP") || indice(data, "IBOV"),
    indice(data, "BRL=X"),
    indice(data, "^GSPC"),
    indice(data, "^IXIC"),
    indice(data, "^VIX"),
  ].filter(Boolean);

  $("kpis").innerHTML = items
    .map((i) => {
      const ch = i.variacao_pct;
      return `<article class="kpi">
        <div class="lbl">${i.nome}</div>
        <div class="val">${fmtNum(i.preco, i.ticker.includes("BVSP") || i.nome.includes("Ibov") ? 0 : 2)}</div>
        <div class="chg ${clsChg(ch)}">${sign(ch)} · 21d ${sign(i.variacao_21d_pct)}</div>
      </article>`;
    })
    .join("");
}

function renderHeat(data) {
  const heat = data.heatmap_setores || [];
  $("heat").innerHTML = heat
    .map(
      (h) => `<div class="heat-item" style="background:${heatColor(h.variacao_media_pct)}">
        <div class="s">${h.setor} · ${h.qtd}</div>
        <div class="n ${clsChg(h.variacao_media_pct)}">${sign(h.variacao_media_pct)}</div>
      </div>`
    )
    .join("");

  const u = data.universo || {};
  $("universe").innerHTML = [
    ["Watchlist", u.acoes],
    ["Altas", u.altas],
    ["Baixas", u.baixas],
    ["Laterais", u.laterais],
    ["Média do dia", sign(u.variacao_media_pct)],
  ]
    .map(([k, v]) => `<div class="pill">${k}: <strong>${v ?? "—"}</strong></div>`)
    .join("");
}

function setores(data) {
  return ["todos", ...new Set((data.acoes || []).map((a) => a.setor))];
}

function renderFilters(data) {
  $("filters").innerHTML = setores(data)
    .map(
      (s) =>
        `<button class="chip ${state.setor === s ? "on" : ""}" data-setor="${s}">${s}</button>`
    )
    .join("");
  $("filters").querySelectorAll(".chip").forEach((btn) => {
    btn.onclick = () => {
      state.setor = btn.dataset.setor;
      paint();
    };
  });
}

function filtradas(data) {
  const q = state.q.trim().toLowerCase();
  return (data.acoes || []).filter((a) => {
    if (state.setor !== "todos" && a.setor !== state.setor) return false;
    if (!q) return true;
    return a.ticker.toLowerCase().includes(q) || (a.nome || "").toLowerCase().includes(q);
  });
}

function sinalPrincipal(a) {
  const s = (a.sinais || []).find((x) => x.nivel !== "neutro") || (a.sinais || [])[0];
  if (!s) return "";
  return `<span class="badge ${s.nivel}">${s.texto}</span>`;
}

function renderLista(rows) {
  const body = rows
    .map((a) => {
      const ch = a.variacao_pct;
      return `<tr>
        <td><span class="tk">${a.ticker}</span><span class="nm">${a.nome} · ${a.setor}</span></td>
        <td class="mono">${fmtNum(a.preco)}</td>
        <td class="mono ${clsChg(ch)}">${sign(ch)}</td>
        <td class="mono ${clsChg(a.variacao_21d_pct)}">${sign(a.variacao_21d_pct)}</td>
        <td class="mono">${a.rsi14 ?? "—"}</td>
        <td class="mono">${fmtInt(a.volume)}</td>
        <td>${spark(a.serie_30d)}</td>
        <td><span class="score"><i style="width:${a.score_tecnico}%;background:${scoreColor(a.score_tecnico)}"></i></span><span class="mono">${a.score_tecnico}</span></td>
        <td>${sinalPrincipal(a)}</td>
      </tr>`;
    })
    .join("");

  $("board").innerHTML = `<article class="card" style="overflow:auto">
    <table>
      <thead>
        <tr>
          <th>Ativo</th><th>Preço</th><th>Dia</th><th>21d</th>
          <th>RSI</th><th>Volume</th><th>30 pregões</th><th>Score</th><th>Sinal técnico</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="9" class="err">Nenhum ativo neste filtro.</td></tr>`}</tbody>
    </table>
  </article>`;
}

function renderMosaico(rows) {
  $("board").innerHTML = `<div class="mosaic">${rows
    .map((a) => {
      const ch = a.variacao_pct;
      const s = (a.sinais || [])[0];
      return `<article class="tile">
        <div class="tk">${a.ticker}</div>
        <div class="px">${fmtNum(a.preco)}</div>
        <div class="${clsChg(ch)}">${sign(ch)} · RSI ${a.rsi14 ?? "—"}</div>
        <div class="sg">${s ? s.texto : a.leitura}</div>
      </article>`;
    })
    .join("")}</div>`;
}

function paint() {
  const data = state.data;
  if (!data) return;
  $("stamp").textContent = (data.gerado_em || "").replace("T", " ") + " (Brasília)";
  renderKpis(data);
  renderHeat(data);
  renderFilters(data);
  const rows = filtradas(data);
  if (state.vista === "mosaico") renderMosaico(rows);
  else renderLista(rows);
}

async function load(refresh = false) {
  $("stamp").textContent = refresh ? "recarregando…" : "carregando…";
  const urls = [`data/market.json${refresh ? `?t=${Date.now()}` : ""}`];

  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(url + " " + res.status);
      state.data = await res.json();
      if (state.data.erro && !state.data.acoes) throw new Error(state.data.erro);
      paint();
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  $("board").innerHTML = `<p class="err">Não foi possível carregar o snapshot do mercado. Tente novamente em alguns instantes. ${lastErr || ""}</p>`;
}

$("q").addEventListener("input", (e) => {
  state.q = e.target.value;
  paint();
});
$("btnVistaLista").onclick = () => {
  state.vista = "lista";
  paint();
};
$("btnVistaMosaico").onclick = () => {
  state.vista = "mosaico";
  paint();
};
$("btnRefresh").onclick = () => load(true);

load(false);
