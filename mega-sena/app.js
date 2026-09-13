const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");
let allDraws = [];
let sourceInfo = {};

function analyse(draws, windowSize) {
  const subset = windowSize ? draws.slice(-windowSize) : draws;
  if (!subset.length) throw new Error("Nenhum concurso encontrado.");
  const last = draws.at(-1), count = subset.length;
  const freq = Array(61).fill(0), lastSeen = Array(61).fill(null);
  const series = Array.from({length:61},()=>[]), sums=[], evenCounts=[], distribution={};
  for (const d of subset) {
    const set = new Set(d.dezenas), evens=d.dezenas.filter(n=>n%2===0).length;
    evenCounts.push(evens); sums.push(d.dezenas.reduce((a,b)=>a+b,0));
    distribution[`${evens}p-${6-evens}i`] = (distribution[`${evens}p-${6-evens}i`]||0)+1;
    for(let n=1;n<=60;n++) series[n].push(set.has(n)?1:0);
    d.dezenas.forEach(n=>freq[n]++);
  }
  for(const d of draws) d.dezenas.forEach(n=>lastSeen[n]=d.concurso);
  const numbers=[];
  for(let n=1;n<=60;n++){
    const recent=series[n].slice(-10).reduce((a,b)=>a+b,0);
    const prior=series[n].slice(-20,-10).reduce((a,b)=>a+b,0);
    numbers.push({n,freq:freq[n],pct:+(freq[n]*100/count).toFixed(2),atraso:last.concurso-lastSeen[n],spark:series[n].slice(-40),hits10:recent,tendencia:recent>prior?"alta":recent<prior?"baixa":"estável"});
  }
  const byFreq=[...numbers].sort((a,b)=>b.freq-a.freq||a.n-b.n);
  const byDelay=[...numbers].sort((a,b)=>b.atraso-a.atraso||a.n-b.n);
  const byLeast=[...numbers].sort((a,b)=>a.freq-b.freq||a.n-b.n);
  const byHot=[...numbers].sort((a,b)=>b.hits10-a.hits10||b.freq-a.freq||a.n-b.n);
  const expected=count*6/60, byMiddle=[...numbers].sort((a,b)=>Math.abs(a.freq-expected)-Math.abs(b.freq-expected)||b.atraso-a.atraso);
  const completeBalanced = pool => {
    const unique=[...new Set(pool)], even=unique.filter(n=>n%2===0).slice(0,3), odd=unique.filter(n=>n%2).slice(0,3);
    return [...even,...odd].sort((a,b)=>a-b);
  };
  const guess=(name,criterion,nums)=>{const values=nums.slice(0,6).sort((a,b)=>a-b),evens=values.filter(n=>n%2===0).length;return{name,criterion,dezenas:values,pares:evens,impares:6-evens,soma:values.reduce((a,b)=>a+b,0)}};
  const mixed=[]; for(let i=0;i<60;i++){if(!mixed.includes(byDelay[i].n))mixed.push(byDelay[i].n);if(!mixed.includes(byFreq[i].n))mixed.push(byFreq[i].n)}
  const step=20,start=Math.floor(Math.min(...sums)/step)*step,end=(Math.floor(Math.max(...sums)/step)+1)*step, ranges=[];
  for(let from=start;from<end;from+=step) ranges.push({de:from,ate:from+step-1,qtd:sums.filter(v=>v>=from&&v<from+step).length});
  return {
    total_historico:draws.length,concursos_analisados:count,esperanca_freq:+expected.toFixed(2),dezenas:numbers,
    ultimo:{...last,pares:last.dezenas.filter(n=>n%2===0).length,impares:last.dezenas.filter(n=>n%2).length,soma:last.dezenas.reduce((a,b)=>a+b,0)},
    mais:byFreq.slice(0,10),menos:byLeast.slice(0,10),atrasadas:byDelay.slice(0,10),
    recentes:draws.slice(-12).reverse().map(d=>({...d,pares:d.dezenas.filter(n=>n%2===0).length,impares:d.dezenas.filter(n=>n%2).length,soma:d.dezenas.reduce((a,b)=>a+b,0)})),
    par_impar:{media_pares:+(evenCounts.reduce((a,b)=>a+b,0)/count).toFixed(2),media_impares:+(6-evenCounts.reduce((a,b)=>a+b,0)/count).toFixed(2),distribuicao:Object.entries(distribution).map(([combo,qtd])=>({combo,qtd,pct:+(qtd*100/count).toFixed(2)})).sort((a,b)=>b.qtd-a.qtd)},
    soma:{media:+(sums.reduce((a,b)=>a+b,0)/count).toFixed(2),min:Math.min(...sums),max:Math.max(...sums),faixas:ranges},
    palpites:[guess("Mais frequentes","As 6 dezenas mais frequentes na janela.",byFreq.map(x=>x.n)),guess("Mais atrasadas","As 6 com maior intervalo desde a última ocorrência.",byDelay.map(x=>x.n)),guess("Atraso + frequência (3p-3i)","Mistura atraso e frequência, equilibrando pares e ímpares.",completeBalanced(mixed)),guess("Menos frequentes","As 6 dezenas menos frequentes na janela.",byLeast.map(x=>x.n)),guess("Quentes recentes (3p-3i)","Mais ocorrências nos últimos 10 concursos.",completeBalanced(byHot.map(x=>x.n))),guess("Meio da curva (3p-3i)","Frequência próxima da média da janela.",completeBalanced(byMiddle.map(x=>x.n)))]
  };
}

const chips = nums => nums.map(n=>`<span class="chip">${pad(n)}</span>`).join("");
const spark = arr => `<div class="spark">${arr.map(v=>`<i class="${v?"on":""}" style="height:${v?100:18}%"></i>`).join("")}</div>`;
const delayClass = value => value<=3?"hot":value<=12?"warm":"cold";

function render(d){
  $("status").innerHTML=`Fonte: ${sourceInfo.fonte||"—"} · atualizado ${new Date(sourceInfo.atualizado_em).toLocaleString("pt-BR")} · ${d.total_historico} concursos · janela: ${d.concursos_analisados}${sourceInfo.aviso?` <span class="err">· ${sourceInfo.aviso}</span>`:""}`;
  const u=d.ultimo;
  $("cards").innerHTML=[["Último concurso",u.concurso,u.data],["Dezenas",u.dezenas.map(pad).join("  "),`pares ${u.pares} · ímpares ${u.impares}`],["Soma do último",u.soma,`média da janela ${d.soma.media}`],["Concursos na janela",d.concursos_analisados,`freq. esperada ≈ ${d.esperanca_freq}`],["Média pares",d.par_impar.media_pares,`ímpares ${d.par_impar.media_impares}`],["Soma min / máx",`${d.soma.min} / ${d.soma.max}`,"das 6 dezenas"]].map(([k,v,s])=>`<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("");
  $("balls").innerHTML=d.dezenas.map(x=>`<article class="ball ${delayClass(x.atraso)}"><div class="num">${pad(x.n)}</div><div class="meta">freq <b>${x.freq}</b> · ${x.pct}%<br>atraso <b>${x.atraso}</b> · ${x.tendencia}</div>${spark(x.spark)}</article>`).join("");
  const table=arr=>`<table><thead><tr><th>#</th><th>freq.</th><th>atraso</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${chips([x.n])}</td><td>${x.freq}</td><td>${x.atraso}</td></tr>`).join("")}</tbody></table>`;
  $("mais").innerHTML=table(d.mais); $("menos").innerHTML=table(d.menos); $("atraso").innerHTML=table(d.atrasadas);
  $("recentes").innerHTML=d.recentes.map(r=>`<div class="pill"><b>#${r.concurso}</b> · ${r.data}<div class="ult">${chips(r.dezenas)}</div><span class="sub">${r.pares} pares · ${r.impares} ímpares · soma ${r.soma}</span></div>`).join("");
  const maxPI=Math.max(...d.par_impar.distribuicao.map(x=>x.qtd),1); $("pi").innerHTML=d.par_impar.distribuicao.map(x=>`<div class="barrow"><div style="width:72px;font-size:.75rem">${x.combo}</div><div class="bar"><span style="width:${100*x.qtd/maxPI}%"></span></div><div class="sub" style="width:76px">${x.qtd} (${x.pct}%)</div></div>`).join("");
  $("palpites").innerHTML=d.palpites.map((p,i)=>`<div class="pill"><b>${i+1}. ${p.nome}</b><div class="ult">${chips(p.dezenas)}</div><span class="sub">${p.pares}p · ${p.impares}i · soma ${p.soma}<br>${p.criterion}</span></div>`).join("");
  const maxSum=Math.max(...d.soma.faixas.map(x=>x.qtd),1); $("somas").innerHTML=d.soma.faixas.map(x=>`<div class="barrow"><div style="width:90px;font-size:.75rem">${x.de}–${x.ate}</div><div class="bar"><span style="width:${100*x.qtd/maxSum}%"></span></div><div class="sub" style="width:40px">${x.qtd}</div></div>`).join("");
}

function rerender(){render(analyse(allDraws,$("janela").value==="todos"?null:Number($("janela").value)))}
async function load(refresh=false){
  const button=$("btn"); button.disabled=true; button.textContent=refresh?"Atualizando…":"Carregando…";
  try{const result=await fetch(`/api/mega-data${refresh?`?t=${Date.now()}`:""}`);const payload=await result.json();if(!result.ok||!payload.ok)throw new Error(payload.erro||"Falha ao carregar");allDraws=payload.draws;sourceInfo=payload;rerender()}
  catch(error){$("status").innerHTML=`<span class="err">${error.message} Tente novamente em alguns instantes.</span>`}
  finally{button.disabled=false;button.textContent="Atualizar histórico"}
}
$("janela").addEventListener("change",rerender); $("btn").addEventListener("click",()=>load(true)); load();

