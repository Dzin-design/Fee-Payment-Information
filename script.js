function applyCompactChartFormatting(){
  if(typeof Chart==='undefined') return;
  Chart.defaults.plugins.tooltip.callbacks = Chart.defaults.plugins.tooltip.callbacks || {};
  Chart.defaults.plugins.tooltip.callbacks.label = compactTooltip;
}

function compactNumber(value){
  const n = Number(value) || 0;
  const a = Math.abs(n);
  if(a >= 1e9) return (n/1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/,'') + 'B';
  if(a >= 1e6) return (n/1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/,'') + 'M';
  if(a >= 1e3) return (n/1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/,'') + 'K';
  return Math.round(n).toLocaleString('en-US');
}
function compactTick(value){ return compactNumber(value); }
function compactTooltip(context){
  const v = context.parsed?.y ?? context.raw ?? 0;
  return `${context.dataset.label || ''}: ${compactNumber(v)}`;
}

let data = [];
let charts = {};
let currentFileName = "";

function initChartPages(){
  const tabs=[...document.querySelectorAll(".chart-tab")];
  const pages=[...document.querySelectorAll(".chart-page")];
  tabs.forEach(tab=>tab.addEventListener("click",()=>{
    const id=tab.dataset.page;
    tabs.forEach(t=>t.classList.toggle("active",t===tab));
    pages.forEach(p=>p.classList.toggle("active",p.id===id));
    // Chart.js ต้องคำนวณขนาดใหม่เมื่อกราฟถูกเปิดจากหน้าที่ซ่อนอยู่
    requestAnimationFrame(()=>{
      Object.values(charts).forEach(c=>{try{c.resize();}catch(e){}});
    });
    window.scrollTo({top:document.querySelector(".chart-nav")?.offsetTop-12||0,behavior:"smooth"});
  }));
}


const DEFAULT_COUNT = [
  "ศูนย์บริการธุรกิจพลังงาน_ราย",
  "บริษัท ไปรษณีย์ไทย จำกัด_ราย",
  "ธนาคารกรุงไทย จำกัด (มหาชน)_ราย",
  "เคาน์เตอร์เซอร์วิส_ราย"
];
const DEFAULT_MONEY = DEFAULT_COUNT.map(x => x.replace(/_ราย$/, "_บาท"));
let COUNT = [...DEFAULT_COUNT];
let MONEY = [...DEFAULT_MONEY];

const Y = "ปีงบประมาณ";
const M = "เดือน";
const L = "กฎหมาย";
const TC = "รวม_ราย";
const TM = "รวม_บาท";
const $ = id => document.getElementById(id);
const clean = v => String(v ?? "").replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").trim();

// แปลงเลขไทยและข้อความประกอบตัวเลข เช่น "฿ 1,234.50 บาท", "1,234 ราย"
function normalizeDigits(v){
  return clean(v).replace(/[๐-๙]/g, d => "๐๑๒๓๔๕๖๗๘๙".indexOf(d));
}
function num(v){
  if(typeof v === "number" && Number.isFinite(v)) return v;
  let s = normalizeDigits(v);
  if(!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[(),]/g, "").replace(/฿|บาท|ราย|คน|ครั้ง|ผู้ชำระ|THB/gi, "");
  s = s.replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
}
const fmt = n => {
  n = Number(n || 0);
  const a = Math.abs(n);
  if (a >= 1e9) return (n/1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/,'') + "B";
  if (a >= 1e6) return (n/1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/,'') + "M";
  if (a >= 1e3) return (n/1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/,'') + "K";
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
};
const sum = (rows, key) => rows.reduce((a, x) => a + num(x[key]), 0);
function selectedChannelKeys(){
  const c=clean($("channel")?.value);
  const countKey=c?COUNT.find(k=>k.replace(/_ราย$/i,"")===c):null;
  const moneyKey=c?MONEY.find(k=>k.replace(/_บาท$/i,"")===c):null;
  return {countKey:countKey||null,moneyKey:moneyKey||null};
}
function rowCount(row){ const {countKey}=selectedChannelKeys(); return countKey?num(row[countKey]):num(row[TC]); }
function rowMoney(row){ const {moneyKey}=selectedChannelKeys(); return moneyKey?num(row[moneyKey]):num(row[TM]); }

const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MONTH_ALIASES = {
  "ม.ค.":"มกราคม","มค":"มกราคม","มกราคม":"มกราคม",
  "ก.พ.":"กุมภาพันธ์","กพ":"กุมภาพันธ์","กุมภาพันธ์":"กุมภาพันธ์",
  "มี.ค.":"มีนาคม","มีค":"มีนาคม","มีนาคม":"มีนาคม",
  "เม.ย.":"เมษายน","เมย":"เมษายน","เมษายน":"เมษายน",
  "พ.ค.":"พฤษภาคม","พค":"พฤษภาคม","พฤษภาคม":"พฤษภาคม",
  "มิ.ย.":"มิถุนายน","มิย":"มิถุนายน","มิถุนายน":"มิถุนายน",
  "ก.ค.":"กรกฎาคม","กค":"กรกฎาคม","กรกฎาคม":"กรกฎาคม",
  "ส.ค.":"สิงหาคม","สค":"สิงหาคม","สิงหาคม":"สิงหาคม",
  "ก.ย.":"กันยายน","กย":"กันยายน","กันยายน":"กันยายน",
  "ต.ค.":"ตุลาคม","ตค":"ตุลาคม","ตุลาคม":"ตุลาคม",
  "พ.ย.":"พฤศจิกายน","พย":"พฤศจิกายน","พฤศจิกายน":"พฤศจิกายน",
  "ธ.ค.":"ธันวาคม","ธค":"ธันวาคม","ธันวาคม":"ธันวาคม"
};
function normalizeMonth(v){
  if(v instanceof Date && !isNaN(v)) return MONTHS[v.getMonth()];
  let s = normalizeDigits(v).toLowerCase().replace(/\s+/g, " ");
  if(!s) return "";
  // รองรับวันที่/ข้อความ เช่น 2567-01-01, 01/01/2567, "เดือนมกราคม"
  const iso = s.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
  if(iso){ const m=Number(iso[2]); if(m>=1&&m<=12) return MONTHS[m-1]; }
  const slash = s.match(/^([0-3]?\d)[-\/]([01]?\d)[-\/]\d{2,4}/);
  if(slash){ const m=Number(slash[2]); if(m>=1&&m<=12) return MONTHS[m-1]; }
  const stripped = s.replace(/^เดือน\s*/, "").replace(/\./g, "").trim();
  if(MONTH_ALIASES[stripped]) return MONTH_ALIASES[stripped];
  const found = MONTHS.find(m => stripped.includes(m));
  if(found) return found;
  return s;
}
function normalizeYear(v){
  let s = normalizeDigits(v);
  const m = s.match(/\d{4}/);
  return m ? m[0] : clean(v);
}
function normalizeText(v){
  return clean(v).replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}
function normalizeLaw(v){ return normalizeText(v); }

function unique(key) { return [...new Set(data.map(x => clean(x[key])).filter(Boolean))]; }
function fill(id, vals) {
  const el = $(id);
  el.innerHTML = '<option value="">ทั้งหมด</option>';
  [...new Set(vals.map(clean).filter(Boolean))].forEach(v => {
    const o = document.createElement("option"); o.value = v; o.textContent = v; el.appendChild(o);
  });
}
function fillChannels() {
  const el = $("channel"); el.innerHTML = '<option value="">ทั้งหมด</option>';
  COUNT.forEach(key => {
    const name = key.replace(/_ราย$/, "");
    const o = document.createElement("option"); o.value = name; o.textContent = name; el.appendChild(o);
  });
}
function refreshMonthOptions(){
  const el=$("month");
  const selected=clean(el.value);
  const y=clean($("year")?.value);
  const rows=y ? data.filter(r=>clean(r[Y])===y) : data;
  const months=orderedMonths(uniqueFromRows(rows,M));
  el.innerHTML='<option value="">ทั้งหมด</option>';
  months.forEach(v=>{
    const o=document.createElement("option"); o.value=v; o.textContent=v; el.appendChild(o);
  });
  if(selected && months.includes(selected)) el.value=selected;
}
function uniqueFromRows(rows,key){ return [...new Set(rows.map(x=>clean(x[key])).filter(Boolean))]; }
function filtered() {
  const y=clean($("year").value), m=clean($("month").value), l=clean($("law").value);
  return data.filter(row => {
    if(y && clean(row[Y])!==y) return false;
    if(m && clean(row[M])!==m) return false;
    if(l && clean(row[L])!==l) return false;
    return true;
  });
}
function destroyCharts(){ Object.values(charts).forEach(c=>c&&c.destroy()); charts={}; }
function monthTotals(rows){
  const result={};
  rows.forEach(row=>{ const month=clean(row[M])||"ไม่ระบุ"; result[month]=(result[month]||0)+rowCount(row); });
  return result;
}
function orderedMonths(values){
  const set=new Set(values.map(clean).filter(Boolean));
  return MONTHS.filter(m=>set.has(m)).concat([...set].filter(m=>!MONTHS.includes(m)));
}
function insights(rows){
  const totals=monthTotals(rows), months=Object.keys(totals);
  if(months.length){
    const max=months.reduce((a,b)=>totals[b]>totals[a]?b:a), min=months.reduce((a,b)=>totals[b]<totals[a]?b:a);
    $("maxMonth").textContent=max; $("maxMonthVal").textContent=fmt(totals[max])+" ราย";
    $("minMonth").textContent=min; $("minMonthVal").textContent=fmt(totals[min])+" ราย";
  } else { $("maxMonth").textContent="-"; $("maxMonthVal").textContent="0 ราย"; $("minMonth").textContent="-"; $("minMonthVal").textContent="0 ราย"; }
  const selected=clean($("channel")?.value);
  const ct=selected
    ? COUNT.filter(k=>k.replace(/_ราย$/,"")===selected).map(k=>({name:selected,value:sum(rows,k)}))
    : COUNT.map(k=>({name:k.replace(/_ราย$/, ""),value:sum(rows,k)}));
  const maxC=ct.reduce((a,b)=>b.value>a.value?b:a,{name:"-",value:0});
  const minC=ct.length ? ct.reduce((a,b)=>b.value<a.value?b:a,{name:"-",value:Infinity}) : {name:"-",value:0};
  $("maxChannel").textContent=maxC.name; $("maxChannelVal").textContent=fmt(maxC.value)+" ราย";
  $("minChannel").textContent=minC.name; $("minChannelVal").textContent=fmt(minC.value)+" ราย";
}
function baseOptions(){
  return {responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:compactTooltip}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>compactTick(v)}}}};
}
function makeForecast(values,steps=3){
  const y=values.map(Number),n=y.length; if(n<2)return Array(steps).fill(y[0]||0);
  const xb=(n-1)/2,yb=y.reduce((a,b)=>a+b,0)/n; let nume=0,den=0;
  for(let i=0;i<n;i++){nume+=(i-xb)*(y[i]-yb);den+=(i-xb)*(i-xb);} const slope=den?nume/den:0,intercept=yb-slope*xb;
  return Array.from({length:steps},(_,j)=>Math.max(0,intercept+slope*(n+j)));
}
function renderForecast(r){
  const el=$("forecast"); if(!el)return; const mt=monthTotals(r),labels=orderedMonths(Object.keys(mt)),vals=labels.map(k=>mt[k]);
  const fc=makeForecast(vals,3),future=["พยากรณ์ +1","พยากรณ์ +2","พยากรณ์ +3"];
  charts.forecast=new Chart(el,{type:"line",data:{labels:labels.concat(future),datasets:[{label:"ข้อมูลจริง",data:vals.concat([null,null,null]),tension:.25,pointRadius:4,borderWidth:3},{label:"พยากรณ์",data:Array(vals.length).fill(null).concat(fc),tension:.25,pointRadius:4,borderWidth:3,borderDash:[7,6]}]},options:{...baseOptions(),plugins:{...baseOptions().plugins,tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)} ราย`}}},scales:{...baseOptions().scales,y:{...baseOptions().scales.y,ticks:{callback:v=>fmt(v)}}}}});
}
function update(){
  const r=filtered(); $("people").textContent=fmt(r.reduce((a,x)=>a+rowCount(x),0)); $("money").textContent=fmt(r.reduce((a,x)=>a+rowMoney(x),0));
  $("months").textContent=new Set(r.map(x=>clean(x[M])).filter(Boolean)).size; $("laws").textContent=new Set(r.map(x=>clean(x[L])).filter(Boolean)).size;
  insights(r); destroyCharts();
  // ถ้าเลือกช่องทางชำระ ให้กราฟช่องทางแสดงเฉพาะช่องทางที่เลือก
  const selectedChannel=clean($("channel").value);
  const activeCountKeys=selectedChannel ? COUNT.filter(k=>k.replace(/_ราย$/,"")===selectedChannel) : COUNT;
  const activeMoneyKeys=selectedChannel ? MONEY.filter(k=>k.replace(/_บาท$/,"")===selectedChannel) : MONEY;
  const labels=activeCountKeys.map(x=>x.replace(/_ราย$/,"")),values=activeCountKeys.map(k=>sum(r,k));
  charts.channelBar=new Chart($("channelBar"),{type:"bar",data:{labels,datasets:[{label:"จำนวนผู้ชำระ (ราย)",data:values}]},options:baseOptions()});
  charts.moneyBar=new Chart($("moneyBar"),{type:"bar",data:{labels:activeMoneyKeys.map(x=>x.replace(/_บาท$/,"")),datasets:[{label:"จำนวนเงิน (บาท)",data:activeMoneyKeys.map(k=>sum(r,k))}]},options:baseOptions()});
  const mt=monthTotals(r),ml=orderedMonths(Object.keys(mt)),mv=ml.map(k=>mt[k]);
  charts.trend=new Chart($("trend"),{type:"line",data:{labels:ml,datasets:[{label:"จำนวนผู้ชำระ",data:mv,tension:.25,pointRadius:4,borderWidth:3}]},options:baseOptions()});
  charts.monthlyBar=new Chart($("monthlyBar"),{type:"bar",data:{labels:ml,datasets:[{label:"จำนวนผู้ชำระ (ราย)",data:mv}]},options:baseOptions()});
  const moneyMonthly={}; r.forEach(row=>{const month=clean(row[M])||"ไม่ระบุ";moneyMonthly[month]=(moneyMonthly[month]||0)+rowMoney(row);});
  const moneyLabels=orderedMonths(Object.keys(moneyMonthly));
  charts.moneyTrend=new Chart($("moneyTrend"),{type:"line",data:{labels:moneyLabels,datasets:[{label:"ยอดเงินรวม (บาท)",data:moneyLabels.map(k=>moneyMonthly[k]),tension:.25,pointRadius:4,borderWidth:3}]},options:baseOptions()});
  renderForecast(r);
  const years=[...new Set(data.map(x=>clean(x[Y])).filter(Boolean))].sort();
  const monthsList=orderedMonths(r.map(x=>x[M]));
  charts.yearCompare=new Chart($("yearCompare"),{type:"line",data:{labels:monthsList,datasets:years.map(y=>({label:"ปีงบประมาณ "+y,data:monthsList.map(m=>{const rowsForMonth=r.filter(x=>clean(x[Y])===y&&clean(x[M])===m); return rowsForMonth.length ? rowsForMonth.reduce((a,x)=>a+rowCount(x),0) : null}),tension:.25,pointRadius:3}))},options:baseOptions()});
  charts.pie=new Chart($("pie"),{type:"doughnut",data:{labels,datasets:[{label:"จำนวนผู้ชำระ",data:values}]},options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:c=>{const value=num(c.raw),total=c.dataset.data.reduce((a,b)=>a+num(b),0),pct=total?((value/total)*100).toFixed(1):"0.0";return `${c.label}: ${fmt(value)} ราย (${pct}%)`;}}}}}});
  const show=[Y,M,L,...COUNT,...MONEY,TC,TM].filter((x,i,a)=>x&&a.indexOf(x)===i);
  $("table").innerHTML="<thead><tr>"+show.map(x=>"<th>"+x+"</th>").join("")+"</tr></thead><tbody>"+r.map(row=>"<tr>"+show.map(k=>"<td>"+(k===Y?clean(row[k]):typeof row[k]==="number"?fmt(row[k]):clean(row[k]))+"</td>").join("")+"</tr>").join("")+"</tbody>";
}

// รองรับชื่อคอลัมน์ที่ต่างกันเล็กน้อยใน Excel และทำความสะอาดข้อมูลก่อนเข้า Dashboard
function findColumn(row, aliases){
  const keys=Object.keys(row); const norm=s=>clean(s).toLowerCase().replace(/[\s_\-()]/g,"");
  for(const alias of aliases){ const a=norm(alias); const exact=keys.find(k=>norm(k)===a); if(exact)return exact; }
  return null;
}
function normalizeRows(input){
  const rows=input.filter(x=>x&&typeof x==="object").map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[clean(k),v])));
  if(!rows.length) throw new Error("ไม่พบข้อมูลในไฟล์ Excel");
  const sample=rows[0];
  const yearCol=findColumn(sample,[Y,"ปีงบประมาณ","Fiscal Year"]);
  const monthCol=findColumn(sample,[M,"เดือนที่","Month"]);
  const lawCol=findColumn(sample,[L,"กฎหมายที่","Law","กฎหมาย/ระเบียบ"]);
  if(!yearCol) throw new Error(`ไม่พบคอลัมน์ “${Y}” ในไฟล์ Excel`);

  return rows.map(raw=>{
    const row={...raw};
    // ทำความสะอาดเฉพาะฟิลด์หลัก
    row[Y]=normalizeYear(raw[yearCol]);
    row[M]=monthCol?normalizeMonth(raw[monthCol]):"";
    row[L]=lawCol?normalizeLaw(raw[lawCol]):"";
    Object.keys(row).forEach(k=>{
      if(/_ราย$|_บาท$|^รวม_ราย$|^รวม_บาท$/i.test(k)) row[k]=num(row[k]);
      else if(typeof row[k]==="string") row[k]=normalizeText(row[k]);
    });
    return row;
  }).filter(row=>{
    // ตัดเฉพาะ "ธันวาคม" ของปีงบประมาณ 2569 เท่านั้น
    // เดือนธันวาคมของปีงบประมาณอื่นยังคงใช้ได้ตามปกติ
    return !(clean(row[Y]) === "2569" && clean(row[M]) === "ธันวาคม");
  }).filter(row=>row[Y] || row[M] || row[L]);
}
function setData(json,fileName=""){
  const rows=normalizeRows(json);
  // หา service columnsจากทุกแถว เพื่อรองรับการเพิ่มช่องทาง/บริการในอนาคต
  const discoveredCount=[...new Set(rows.flatMap(r=>Object.keys(r)).filter(k=>/_ราย$/i.test(k)&&k!==TC))];
  const discoveredMoney=[...new Set(rows.flatMap(r=>Object.keys(r)).filter(k=>/_บาท$/i.test(k)&&k!==TM))];
  if(discoveredCount.length){COUNT=discoveredCount;MONEY=discoveredMoney.length?discoveredMoney:discoveredCount.map(k=>k.replace(/_ราย$/i,"_บาท"));}
  rows.forEach(x=>{
    if(!Object.prototype.hasOwnProperty.call(x,TC)) x[TC]=COUNT.reduce((a,k)=>a+num(x[k]),0);
    else x[TC]=num(x[TC]);
    if(!Object.prototype.hasOwnProperty.call(x,TM)) x[TM]=MONEY.reduce((a,k)=>a+num(x[k]),0);
    else x[TM]=num(x[TM]);
  });
  data=rows;currentFileName=fileName;
  $("fileName").textContent=fileName?`ไฟล์ที่ใช้งาน: ${fileName} (${rows.length.toLocaleString("th-TH")} แถว)`:`ใช้ข้อมูลตัวอย่าง (${rows.length} แถว)`;
  fill("year",unique(Y));
  refreshMonthOptions();
  fill("law",unique(L));fillChannels();update();
}
async function loadDefault(){
  // ใช้ไฟล์ Excel เป็นแหล่งข้อมูลหลัก เพราะ data.json รุ่นเดิมขาดข้อมูลเดือนธันวาคม 2568
  const response=await fetch("data/update.xlsx?v=20260917-2", {cache:"no-store"});
  if(!response.ok) throw new Error("โหลด data/update.xlsx ไม่สำเร็จ");
  const buffer=await response.arrayBuffer();
  const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  const rows=excelToRows(wb);
  setData(rows,"update.xlsx");
}
function excelToRows(workbook){
  const all=[];
  workbook.SheetNames.forEach(name=>{
    const sheet=workbook.Sheets[name];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:true});
    rows.forEach(row=>all.push(row));
  });
  return all;
}

$("excelFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{$("fileName").textContent="กำลังอ่านและทำความสะอาดไฟล์ Excel...";const buffer=await file.arrayBuffer();const wb=XLSX.read(buffer,{type:"array",cellDates:true});const rows=excelToRows(wb);setData(rows,file.name);}
  catch(err){console.error(err);alert("อ่านไฟล์ Excel ไม่ได้: "+err.message);$("fileName").textContent="ใช้ข้อมูลเดิม";}
  e.target.value="";
});

// ดาวน์โหลดข้อมูลตามตัวกรองที่เลือกอยู่
// ถ้าเดือน = "ทั้งหมด" จะดาวน์โหลดข้อมูลทุกเดือนที่ตรงกับตัวกรองอื่น ๆ
$("downloadFiltered").addEventListener("click",()=>{
  const selectedMonth=clean($("month").value);
  const rows=filtered();
  if(!rows.length){
    alert(selectedMonth ? `ไม่พบข้อมูลสำหรับเดือน ${selectedMonth}` : "ไม่พบข้อมูลตามตัวกรองที่เลือก");
    return;
  }

  const exportRows=rows.map(row=>{
    const out={};
    const columns=[Y,M,L,...COUNT,...MONEY,TC,TM].filter((x,i,a)=>x&&a.indexOf(x)===i);
    columns.forEach(k=>out[k]=row[k]??"");
    return out;
  });

  const ws=XLSX.utils.json_to_sheet(exportRows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"ข้อมูลที่เลือก");

  const y=clean($("year").value)||"ทุกปี";
  const monthLabel=selectedMonth || "ทุกเดือน";
  const safeMonth=monthLabel.replace(/[\\/:*?"<>|]/g,"-");
  XLSX.writeFile(wb,`ข้อมูลค่าธรรมเนียม_${y}_${safeMonth}.xlsx`);
});

["month","law","channel"].forEach(id=>$(id).addEventListener("change",update));
$("year").addEventListener("change",()=>{ refreshMonthOptions(); update(); });
$("reset").addEventListener("click",()=>{["year","month","law","channel"].forEach(id=>$(id).value="");refreshMonthOptions();update();});
loadDefault().catch(err=>{console.error(err);alert("โหลดข้อมูลไม่ได้: "+err.message);});

window.addEventListener("DOMContentLoaded", initChartPages);
