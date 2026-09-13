const HISTORY_URL = "https://raw.githubusercontent.com/eitchtee/loterias.json/main/data/mega-sena.json";
const CAIXA_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(body)
});

function dezenas(values = []) {
  return [...new Set(values.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 60))].sort((a,b) => a-b);
}

function parseHistory(payload) {
  if (!Array.isArray(payload)) throw new Error("Histórico em formato inválido");
  return payload.map(item => ({
    concurso: Number(item.concurso),
    data: String(item.data || ""),
    dezenas: dezenas(item.resultado || item.dezenas || [])
  })).filter(x => Number.isInteger(x.concurso) && x.dezenas.length === 6)
    .sort((a,b) => a.concurso-b.concurso);
}

function parseCaixa(payload) {
  if (!payload || typeof payload !== "object") return null;
  const concurso = Number(payload.numero || payload.concurso);
  const nums = dezenas(payload.listaDezenas || payload.dezenas || payload.dezenasSorteadasOrdemSorteio || []);
  if (!Number.isInteger(concurso) || nums.length !== 6) return null;
  return { concurso, data: String(payload.dataApuracao || payload.data || ""), dezenas: nums };
}

async function getJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "MapaDeSinais/1.0" }, signal: controller.signal });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return await result.json();
  } finally { clearTimeout(timer); }
}

exports.handler = async () => {
  try {
    const draws = parseHistory(await getJson(HISTORY_URL, 30000));
    let fonte = "loterias.json (espelho público do histórico Caixa)";
    let aviso = "";
    try {
      const latest = parseCaixa(await getJson(CAIXA_URL, 12000));
      if (latest && !draws.some(d => d.concurso === latest.concurso)) {
        draws.push(latest); draws.sort((a,b) => a.concurso-b.concurso);
        fonte += " + API Caixa";
      } else if (latest) fonte += " | último conferido na API Caixa";
    } catch (error) {
      aviso = `API Caixa temporariamente indisponível; usando o histórico público. (${error.message})`;
    }
    return response(200, { ok:true, draws, fonte, aviso, atualizado_em:new Date().toISOString() });
  } catch (error) {
    return response(502, { ok:false, erro:`Não foi possível carregar o histórico: ${error.message}` });
  }
};

