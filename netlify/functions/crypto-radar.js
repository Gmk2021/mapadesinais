const BINANCE = "https://data-api.binance.vision";
const CDC = "https://api.crypto.com/exchange/v1/public";
const TOP = 8, MAX_UP = 80, MIN_BINANCE_VOLUME = 5_000_000, MIN_CDC_VOLUME = 200_000;

const jsonResponse = (statusCode, body) => ({statusCode,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=20, s-maxage=40, stale-while-revalidate=60","Access-Control-Allow-Origin":"*"},body:JSON.stringify(body)});
const number = (value, fallback=null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

async function getJson(url, timeout=10000){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"MapaDeSinais/1.0"},signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json()}finally{clearTimeout(timer)}
}
function pace(day,hour){if(hour==null)return "?";if(day>0&&hour>=3)return "acelera";if(day>0&&hour<=0)return "esfriou";if(day<0&&hour<=-3)return "cai mais";if(day<0&&hour>=0)return "reagiu";return "estável"}
function rank(items){const valid=items.filter(x=>x.var24<=MAX_UP);return{n:items.length,pumps:items.length-valid.length,altas:[...valid].sort((a,b)=>b.var24-a.var24).slice(0,TOP),baixas:[...valid].sort((a,b)=>a.var24-b.var24).slice(0,TOP)}}

async function mapLimited(items, mapper, limit=8){
  const result=new Array(items.length);let cursor=0;
  async function worker(){while(cursor<items.length){const i=cursor++;try{result[i]=await mapper(items[i])}catch{result[i]={...items[i],spark:[],var1h:null,ritmo:"?"}}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return result;
}
async function enrich(data, candle){data.altas=await mapLimited(data.altas,candle);data.baixas=await mapLimited(data.baixas,candle);return data}

async function binanceCandle(item){const rows=await getJson(`${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(item.symbol)}&interval=1h&limit=24`,8000);const spark=rows.map(k=>number(k[4],0));const last=rows.at(-1),open=last?number(last[1]):null,close=last?number(last[4]):null;const var1h=open?(close-open)/open*100:null;return{...item,spark,var1h,ritmo:pace(item.var24,var1h)}}
async function binance(){const rows=await getJson(`${BINANCE}/api/v3/ticker/24hr`,12000);const items=rows.filter(t=>String(t.symbol||"").endsWith("USDT")).map(t=>({base:t.symbol.slice(0,-4),symbol:t.symbol,var24:number(t.priceChangePercent,0),volume:number(t.quoteVolume,0)})).filter(x=>x.volume>=MIN_BINANCE_VOLUME);return enrich(rank(items),binanceCandle)}

async function cdcCandle(item){const payload=await getJson(`${CDC}/get-candlestick?instrument_name=${encodeURIComponent(item.symbol)}&timeframe=1h&count=24`,8000);const rows=payload?.result?.data||[];const spark=rows.map(c=>number(c.c,0));const last=rows.at(-1),open=last?number(last.o):null,close=last?number(last.c):null;const var1h=open?(close-open)/open*100:null;return{...item,spark,var1h,ritmo:pace(item.var24,var1h)}}
async function cryptoDotCom(){const payload=await getJson(`${CDC}/get-tickers`,12000);if(payload.code!==0&&payload.code!=null)throw new Error(`Código ${payload.code}`);const items=(payload?.result?.data||[]).map(t=>{const symbol=String(t.i||t.instrument_name||"");let change=number(t.c??t.change);if(change!=null&&Math.abs(change)<=1.5)change*=100;return{base:symbol.slice(0,-5),symbol,var24:change,volume:number(t.vv??t.volume??t.v,0)}}).filter(x=>x.symbol.endsWith("_USDT")&&!x.symbol.includes("-")&&x.var24!=null&&x.volume>=MIN_CDC_VOLUME);return enrich(rank(items),cdcCandle)}

exports.handler=async()=>{
  const [b,c]=await Promise.allSettled([binance(),cryptoDotCom()]);
  const body={ok:true,hora:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()),binance:b.status==="fulfilled"?b.value:{error:`Binance: ${b.reason?.message||"indisponível"}`},cdc:c.status==="fulfilled"?c.value:{error:`Crypto.com: ${c.reason?.message||"indisponível"}`}};
  return jsonResponse(200,body);
};
