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
// รูปแบบไฟล์เป็น Excel-compatible .xls พร้อมตารางแบบมีช่อง/เส้นขอบ/หัวตารางรวม
function excelCell(v){
  if(v===null || v===undefined) return "";
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function exportAsExcelGrid(rows, fileName, title, filterText){
  const columns=[Y,M,L,...COUNT,...MONEY,TC,TM].filter((x,i,a)=>x&&a.indexOf(x)===i);
  const channelCount=COUNT.filter(k=>columns.includes(k));
  const channelMoney=MONEY.filter(k=>columns.includes(k));
  const grouped = [
    {label:"ข้อมูลช่วงเวลา", span:2},
    {label:"ข้อมูลกฎหมาย", span:1},
    {label:"จำนวนผู้ชำระ (ราย)", span:channelCount.length},
    {label:"จำนวนเงิน (บาท)", span:channelMoney.length},
    {label:"รวม", span:2}
  ].filter(g=>g.span>0);

  const header2=columns.map(k=>`<th>${excelCell(k)}</th>`).join("");
  const body=rows.map((row,idx)=>{
    return `<tr><td class="center">${idx+1}</td>` + columns.map(k=>{
      const v=row[k]??"";
      const isNum=/_ราย$|_บาท$|^รวม_ราย$|^รวม_บาท$/i.test(k);
      return `<td class="${isNum?"num":""}">${excelCell(isNum?num(v):v)}</td>`;
    }).join("") + `</tr>`;
  }).join("");

  const groupRow=`<tr><th rowspan="2" class="no">ลำดับ</th>${grouped.map(g=>`<th colspan="${g.span}">${excelCell(g.label)}</th>`).join("")}</tr>`;
  const totalRow=`<tr class="total"><td colspan="${Math.max(1,columns.length)}"><b>รวม ${rows.length.toLocaleString("th-TH")} รายการ</b></td></tr>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt;color:#17283b}table,th,td{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt}
    h1{text-align:center;font-size:16pt;margin:0 0 8px}
    .meta{margin-bottom:12px;color:#555}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #333;padding:6px 8px;vertical-align:middle}
    th{background:#d9eaf7;text-align:center;font-weight:bold}
    tr:nth-child(even) td{background:#f8fbfd}
    td.num{text-align:right;mso-number-format:"#,##0.00"}
    td.center{text-align:center}
    th.no{width:55px}
    .total td{background:#eaf2f8;font-weight:bold}
  </style></head><body>
  <h1>${excelCell(title)}</h1>
  <div class="meta">${excelCell(filterText)}</div>
  <table><thead>${groupRow}<tr>${header2}</tr></thead><tbody>${body}${totalRow}</tbody></table>
  </body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=fileName;a.style.display="none";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}

$("downloadFiltered").addEventListener("click",()=>{
  const selectedMonth=clean($("month").value);
  const rows=filtered();
  if(!rows.length){
    alert(selectedMonth ? `ไม่พบข้อมูลสำหรับเดือน ${selectedMonth}` : "ไม่พบข้อมูลตามตัวกรองที่เลือก");
    return;
  }
  const y=clean($("year").value)||"ทุกปี";
  const monthLabel=selectedMonth||"ทุกเดือน";
  const lawLabel=clean($("law").value)||"ทุกกฎหมาย";
  const channelLabel=clean($("channel").value)||"ทุกช่องทาง";
  const safeMonth=monthLabel.replace(/[\\/:*?"<>|]/g,"-");
  const title=`รายงานข้อมูลค่าธรรมเนียม ปีงบประมาณ ${y}`;
  const filterText=`ตัวกรอง: เดือน ${monthLabel} | กฎหมาย ${lawLabel} | ช่องทาง ${channelLabel}`;
  exportAsExcelGrid(rows,`รายงานค่าธรรมเนียม_${y}_${safeMonth}.xls`,title,filterText);
});

["month","law","channel"].forEach(id=>$(id).addEventListener("change",update));
$("year").addEventListener("change",()=>{ refreshMonthOptions(); update(); });
$("reset").addEventListener("click",()=>{["year","month","law","channel"].forEach(id=>$(id).value="");refreshMonthOptions();update();});
window.addEventListener("DOMContentLoaded", initChartPages);


/* =========================
   DAILY REPORT ENTRY / AUTO-SAVED LOCAL STORAGE
   ========================= */
const MANUAL_KEY = "fee_dashboard_daily_report_v6";
const ENTRY_CHANNELS = {
  "ศบธ.": {label:"ศูนย์บริการธุรกิจ (ศบธ.)", file:"sbth.xlsx", template:"ทะเบียนคุมเคาน์เตอร์ศบธ. 69.xlsx"},
  "ไปรษณีย์": {label:"ไปรษณีย์", file:"post.xlsx", template:"ทะเบียนคุมไปรษณีย์ 69.xlsx"},
  "ธนาคาร": {label:"ธนาคาร", file:"bank.xlsx", template:"ทะเบียนคุมธนาคาร 69.xlsx"},
  "เคาน์เตอร์เซอร์วิส": {label:"เคาน์เตอร์เซอร์วิส", file:"service.xlsx", template:"ทะเบียนคุมเคาน์เตอร์เซอร์วิส  69.xlsx"}
};
let activeEntryChannel = "ศบธ.";
let cloudEntries = [];
let cloudReady = false;
const hasCloudConfig = () => !!(window.FEE_SUPABASE_URL && window.FEE_SUPABASE_PUBLISHABLE_KEY && !String(window.FEE_SUPABASE_URL).includes("ใส่_"));
const cloudClient = hasCloudConfig() && window.supabase ? window.supabase.createClient(window.FEE_SUPABASE_URL, window.FEE_SUPABASE_PUBLISHABLE_KEY) : null;
function getManualEntries(){ return cloudReady ? cloudEntries : JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]"); }
function saveManualEntries(entries){ cloudEntries = entries; if(!cloudReady) localStorage.setItem(MANUAL_KEY, JSON.stringify(entries)); }
async function initCloudStorage(){
  if(!cloudClient){ cloudReady=false; return; }
  try{
    const {data,error}=await cloudClient.from("daily_entries").select("id,payload,created_at").order("created_at",{ascending:true});
    if(error) throw error;
    cloudEntries=(data||[]).map(r=>({...r.payload,id:r.id}));
    cloudReady=true;

    // ย้ายข้อมูลเก่าจากเครื่องนี้ขึ้น Cloud แบบปลอดภัย:
    // - ไม่ลบ localStorage จนกว่าจะอัปโหลดสำเร็จทั้งหมด
    // - ไม่สนใจรายการที่มี id เดิมอยู่บน Cloud แล้ว
    // - รองรับข้อมูลเก่าที่ไม่มี id โดยสร้าง id ให้ใหม่
    const oldRaw=localStorage.getItem(MANUAL_KEY);
    if(oldRaw){
      let old=[];
      try{ old=JSON.parse(oldRaw)||[]; }catch(_) { old=[]; }
      const cloudIds=new Set(cloudEntries.map(x=>String(x.id)));
      const pending=old.filter(x=>x && !cloudIds.has(String(x.id)));
      for(const rawEntry of pending){
        const entry={...rawEntry,id:rawEntry.id || (crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random())};
        const {error:insertError}=await cloudClient.from("daily_entries").insert({id:entry.id,payload:entry});
        if(insertError) throw insertError;
      }
      if(pending.length){
        const {data:again,error:reloadError}=await cloudClient.from("daily_entries").select("id,payload,created_at").order("created_at",{ascending:true});
        if(reloadError) throw reloadError;
        cloudEntries=(again||[]).map(r=>({...r.payload,id:r.id}));
      }
      // ลบสำเนาในเครื่องเฉพาะเมื่อ Cloud รับข้อมูลเรียบร้อยแล้ว
      localStorage.removeItem(MANUAL_KEY);
    }
  }catch(e){
    console.error(e);
    cloudReady=false;
    try{ cloudEntries=JSON.parse(localStorage.getItem(MANUAL_KEY)||"[]"); }catch(_){ cloudEntries=[]; }
    alert("เชื่อมต่อ Cloud ไม่สำเร็จ ข้อมูลเดิมในเครื่องยังไม่ถูกลบ\n\n"+e.message);
  }
}
async function cloudInsertEntry(entry){
  if(!cloudClient || !cloudReady) return;
  const {error}=await cloudClient.from("daily_entries").insert({id:entry.id,payload:entry});
  if(error) throw error;
}
async function cloudDeleteEntry(id){
  if(!cloudClient || !cloudReady) return;
  const {error}=await cloudClient.from("daily_entries").delete().eq("id",id);
  if(error) throw error;
}
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c])); }
const THAI_MONTH_SHORT=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function parseUserDate(value){
  let raw=normalizeDigits(value).trim().replace(/\s+/g," "); if(!raw) return "";
  // รองรับค่าจากช่องเลือกวันที่ HTML (<input type="date">) โดยตรง เช่น 2026-09-17
  let isoMatch=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(isoMatch){
    const y=Number(isoMatch[1]), mo=Number(isoMatch[2]), d=Number(isoMatch[3]);
    const dt=new Date(y,mo-1,d);
    if(dt.getFullYear()===y && dt.getMonth()===mo-1 && dt.getDate()===d) return raw;
    return "";
  }
  raw=raw.replace(/[\-\.]/g,"/");
  let m=raw.match(/^(\d{1,2})\s*[/ ]\s*([^/ ]+)\s*[/ ]\s*(\d{2,4})$/);
  let day,month,year;
  if(m){ day=Number(m[1]); year=Number(m[3]); const token=m[2].replace(/\./g,"").trim(); const aliases={"มค":1,"มกราคม":1,"กพ":2,"กุมภาพันธ์":2,"มีค":3,"มีนาคม":3,"เมย":4,"เมษายน":4,"พค":5,"พฤษภาคม":5,"มิย":6,"มิถุนายน":6,"กค":7,"กรกฎาคม":7,"สค":8,"สิงหาคม":8,"กย":9,"กันยายน":9,"ตค":10,"ตุลาคม":10,"พย":11,"พฤศจิกายน":11,"ธค":12,"ธันวาคม":12}; month=aliases[token]; if(!month) month=Number(token); }
  if(!month){ m=raw.match(/^(\d{1,2})\s*[/ ]\s*(\d{1,2})\s*[/ ]\s*(\d{2,4})$/); if(m){day=Number(m[1]);month=Number(m[2]);year=Number(m[3]);} }
  if(!day||!month||!year) return ""; if(year<100) year+=2500; if(year>=2400) year-=543;
  const d=new Date(year,month-1,day); if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day) return "";
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
function displayDate(value){
  const iso=parseUserDate(value)||clean(value); if(!iso) return ""; const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return iso;
  return `${Number(m[3])} ${THAI_MONTH_SHORT[Number(m[2])-1]} ${Number(m[1])+543}`;
}
function monthFromDate(iso){ if(!iso) return ""; const d=new Date(iso+"T00:00:00"); return Number.isNaN(d.getTime())?"":MONTHS[d.getMonth()]; }
function fiscalYearFromDate(iso){ if(!iso) return ""; const d=new Date(iso+"T00:00:00"); if(Number.isNaN(d.getTime()))return ""; const y=d.getFullYear(),m=d.getMonth()+1; return String(y+(m>=10?544:543)); }
function totalSafetyCount(e){ return num(e.safetyCount); }
function totalSafetyMoney(e){ return num(e.safetyMoney); }
function totalSafetyCancelCount(e){ return num(e.safetyCancelCount); }
function totalReceiptCount(e){ return num(e.receiptCount); }
function totalReceiptMoney(e){ return num(e.receiptMoney); }
function totalAppCount(e){ return num(e.appCount); }
function totalAppMoney(e){ return num(e.appMoney); }
function totalTradeCount(e){ return num(e.tradeCount); }
function totalTradeMoney(e){ return num(e.tradeMoney); }
function totalGovCount(e){ return num(e.govCount); }
function totalGovMoney(e){ return num(e.govMoney); }
function reportTotalCount(e){ return totalReceiptCount(e)+totalAppCount(e)+totalTradeCount(e); }
function reportTotalMoney(e){ return totalReceiptMoney(e)+totalAppMoney(e)+totalTradeMoney(e); }

function manualEntriesToRows(entries){
  return entries.map(e=>({
    [Y]:clean(e.year), [M]:clean(e.month)||monthFromDate(e.date), [L]:clean(e.law),
    "วันที่ชำระ":clean(e.date),
    "Manual_Safety_Count":totalSafetyCount(e), "Manual_Safety_Money":totalSafetyMoney(e),
    "Manual_Safety_Cancel_Count":totalSafetyCancelCount(e), "Manual_Safety_Cancel_No":clean(e.safetyCancelNo),
    "Receipt_จาก":clean(e.receiptFrom), "Receipt_ถึง":clean(e.receiptTo),
    "Manual_Receipt_Count":totalReceiptCount(e), "Manual_Receipt_Money":totalReceiptMoney(e),
    "Manual_Receipt_Cancel_Count":num(e.receiptCancelCount), "Manual_Receipt_Cancel_No":clean(e.receiptCancelNo),
    "App_หมายเลขเล่ม":clean(e.appBookNo), "App_จาก":clean(e.appFrom), "App_ถึง":clean(e.appTo),
    "Manual_App_Count":totalAppCount(e), "Manual_App_Money":totalAppMoney(e),
    "Manual_App_Cancel_Count":num(e.appCancelCount), "Manual_App_Cancel_No":clean(e.appCancelNo),
    "Trade_จาก":clean(e.tradeFrom), "Trade_ถึง":clean(e.tradeTo),
    "Manual_Trade_Count":totalTradeCount(e), "Manual_Trade_Money":totalTradeMoney(e),
    "Manual_Trade_Cancel_Count":num(e.tradeCancelCount), "Manual_Trade_Cancel_No":clean(e.tradeCancelNo),
    "Manual_Gov_Count":totalGovCount(e), "Manual_Gov_Money":totalGovMoney(e),
    "หมายเหตุ":clean(e.note), "พน0401.1/":clean(e.pn), "EDC":clean(e.edc), "วันที่ส่ง":clean(e.sent),
    [TC]:reportTotalCount(e), [TM]:reportTotalMoney(e), "แหล่งข้อมูล":"ป้อนเอง"
  }));
}


// Keep original imported Excel data + manually entered daily report rows.
let excelCacheRows=[];
const _originalSetData = setData;
setData = function(input,fileName=""){
  const manual=getManualEntries();
  const rows=normalizeRows(input);
  rows.push(...manualEntriesToRows(manual));
  if(!rows.length) throw new Error("ไม่พบข้อมูล");
  const discoveredCount=[...new Set(rows.flatMap(r=>Object.keys(r)).filter(k=>/_ราย$/i.test(k)&&k!==TC))];
  const discoveredMoney=[...new Set(rows.flatMap(r=>Object.keys(r)).filter(k=>/_บาท$/i.test(k)&&k!==TM))];
  if(discoveredCount.length){COUNT=discoveredCount;MONEY=discoveredMoney.length?discoveredMoney:discoveredCount.map(k=>k.replace(/_ราย$/i,"_บาท"));}
  rows.forEach(x=>{
    if(!Object.prototype.hasOwnProperty.call(x,TC)) x[TC]=COUNT.reduce((a,k)=>a+num(x[k]),0); else x[TC]=num(x[TC]);
    if(!Object.prototype.hasOwnProperty.call(x,TM)) x[TM]=MONEY.reduce((a,k)=>a+num(x[k]),0); else x[TM]=num(x[TM]);
  });
  data=rows;currentFileName=fileName;
  $("fileName").textContent=fileName?`ไฟล์ที่ใช้งาน: ${fileName} (${rows.length.toLocaleString("th-TH")} แถว)${manual.length?` + ข้อมูลที่ป้อนเอง ${manual.length} รายการ`:""}`:`ใช้ข้อมูลตัวอย่าง (${rows.length} แถว)`;
  fill("year",unique(Y)); refreshMonthOptions(); fill("law",unique(L)); fillChannels();
  update(); renderEntryTable(); renderSummary();
};

function initThaiDatePickers(){
  const months=MONTHS;
  const monthShort=THAI_MONTH_SHORT;
  const weekdays=["อา","จ","อ","พ","พฤ","ศ","ส"];
  const now=new Date();
  const currentCE=now.getFullYear();
  const currentBE=currentCE+543;
  const minBE=2500, maxBE=2600;
  const pickerState={};

  function fmtButtonDate(iso){
    return displayDate(iso)||"เลือกวันที่";
  }

  function setup(targetId){
    const target=$(targetId), wrap=document.querySelector(`.thai-calendar-wrap[data-target="${targetId}"]`);
    if(!target||!wrap)return;
    const button=wrap.querySelector('.thai-date-button'), calendar=wrap.querySelector('.thai-calendar'), label=wrap.querySelector('.date-button-text');
    let selected=target.value?parseUserDate(target.value):"";
    let view=selected?new Date(selected+"T00:00:00"):new Date();
    if(view.getFullYear()<minBE-543||view.getFullYear()>maxBE-543)view=new Date(currentCE,currentCE?now.getMonth():0,1);
    pickerState[targetId]={target,button,calendar,label,get selected(){return selected},set selected(v){selected=v},get view(){return view},set view(v){view=v}};

    function render(){
      const st=pickerState[targetId], y=st.view.getFullYear(), m=st.view.getMonth();
      const be=y+543, first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
      const prevDisabled=(y*12+m)<=((minBE-543)*12);
      const nextDisabled=(y*12+m)>=((maxBE-543)*12+11);
      const monthOptions=months.map((name,i)=>`<option value="${i}" ${i===m?'selected':''}>${esc(name)}</option>`).join('');
      const yearOptions=Array.from({length:maxBE-minBE+1},(_,i)=>minBE+i).map(v=>`<option value="${v}" ${v===be?'selected':''}>${v}</option>`).join('');
      let cells='';
      for(let i=0;i<first;i++) cells+='<span class="cal-day empty"></span>';
      for(let d=1;d<=days;d++){
        const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const active=st.selected===iso?' selected':'';
        const today=iso===`${currentCE}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`?' today':'';
        cells+=`<button type="button" class="cal-day${active}${today}" data-iso="${iso}">${d}</button>`;
      }
      calendar.innerHTML=`
        <div class="cal-top">
          <button type="button" class="cal-nav" data-nav="prev" aria-label="เดือนก่อนหน้า" ${prevDisabled?'disabled':''}>‹</button>
          <div class="cal-selects">
            <select class="cal-month" aria-label="เดือน">${monthOptions}</select>
            <select class="cal-year" aria-label="ปี พ.ศ.">${yearOptions}</select>
          </div>
          <button type="button" class="cal-nav" data-nav="next" aria-label="เดือนถัดไป" ${nextDisabled?'disabled':''}>›</button>
        </div>
        <div class="cal-title">${esc(months[m])} ${be}</div>
        <div class="cal-weekdays">${weekdays.map(x=>`<span>${x}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-bottom"><button type="button" class="cal-today">วันนี้</button><button type="button" class="cal-clear">ล้างวันที่</button></div>`;
      label.textContent=fmtButtonDate(st.selected);
      button.classList.toggle('has-value',!!st.selected);
      button.setAttribute('aria-expanded', calendar.classList.contains('open')?'true':'false');

      calendar.querySelector('[data-nav="prev"]')?.addEventListener('click',()=>{st.view=new Date(y,m-1,1);render()});
      calendar.querySelector('[data-nav="next"]')?.addEventListener('click',()=>{st.view=new Date(y,m+1,1);render()});
      calendar.querySelector('.cal-month')?.addEventListener('change',e=>{st.view=new Date(y,Number(e.target.value),1);render()});
      calendar.querySelector('.cal-year')?.addEventListener('change',e=>{st.view=new Date(Number(e.target.value)-543,m,1);render()});
      calendar.querySelectorAll('.cal-day[data-iso]').forEach(btn=>btn.addEventListener('click',()=>{
        st.selected=btn.dataset.iso; target.value=st.selected; label.textContent=fmtButtonDate(st.selected); button.classList.add('has-value'); closeAllCalendars();
      }));
      calendar.querySelector('.cal-today')?.addEventListener('click',()=>{
        st.selected=`${currentCE}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; target.value=st.selected; st.view=new Date(currentCE,now.getMonth(),1); render(); closeAllCalendars();
      });
      calendar.querySelector('.cal-clear')?.addEventListener('click',()=>{st.selected='';target.value='';label.textContent='เลือกวันที่';button.classList.remove('has-value');closeAllCalendars()});
    }
    // ป้องกันคลิกภายในปฏิทินไม่ให้ event ไปถึง window แล้วปิดปฏิทิน
    calendar.addEventListener('click',e=>e.stopPropagation());
    button.addEventListener('click',e=>{e.stopPropagation();closeAllCalendars(calendar);calendar.classList.toggle('open');button.setAttribute('aria-expanded',calendar.classList.contains('open')?'true':'false')});
    render();
  }
  function closeAllCalendars(except=null){
    document.querySelectorAll('.thai-calendar.open').forEach(el=>{if(el!==except)el.classList.remove('open')});
    document.querySelectorAll('.thai-date-button[aria-expanded="true"]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  }
  window.addEventListener('click',()=>closeAllCalendars());
  setup('entryDate'); setup('entrySent');
}
function clearThaiDatePicker(targetId){
  const t=$(targetId); if(!t)return;
  t.value='';
  const wrap=document.querySelector(`.thai-calendar-wrap[data-target="${targetId}"]`);
  if(wrap){ const label=wrap.querySelector('.date-button-text'); const button=wrap.querySelector('.thai-date-button'); if(label)label.textContent='เลือกวันที่'; if(button)button.classList.remove('has-value'); }
}
const ENTRY_FIELDS_BY_CHANNEL = {
  "ศบธ.": ["safety","receipt","trade","gov"],
  "ธนาคาร": ["safety","receipt","trade"],
  "ไปรษณีย์": ["receipt","app","trade"],
  "เคาน์เตอร์เซอร์วิส": ["trade"]
};
function updateEntryFormForChannel(){
  const active = ENTRY_FIELDS_BY_CHANNEL[activeEntryChannel] || ENTRY_FIELDS_BY_CHANNEL["ธนาคาร"];
  document.querySelectorAll("[data-entry-section]").forEach(el=>{
    el.classList.toggle("entry-section-hidden", !active.includes(el.dataset.entrySection));
  });
  const edcWrap=$("entryEdcWrap");
  if(edcWrap) edcWrap.classList.toggle("entry-section-hidden", activeEntryChannel!=="ศบธ.");
  const lawWrap=$("entryLaw")?.closest("label");
  if(lawWrap) lawWrap.classList.remove("entry-section-hidden");
  const yearInput=$("entryYear");
  if(yearInput){ yearInput.readOnly=true; yearInput.placeholder="สร้างอัตโนมัติจากวันที่"; }
  const note=$("entryChannelNote");
  if(note){
    const labels={
      "ศบธ.":"ศูนย์บริการธุรกิจ (ศบธ.) — Safety + Receipt + Trade + นำรายได้ + EDC",
      "ธนาคาร":"ธนาคาร — Safety + Receipt + Trade",
      "ไปรษณีย์":"ไปรษณีย์ — Receipt + App + Trade",
      "เคาน์เตอร์เซอร์วิส":"เคาน์เตอร์เซอร์วิส — Trade เท่านั้น"
    };
    note.innerHTML=`กำลังป้อนข้อมูลสำหรับ <b>${esc(labels[activeEntryChannel]||activeEntryChannel)}</b> — ช่องกรอกจะเปลี่ยนตามคอลัมน์ของ Excel ต้นฉบับ`;
  }
}
function resetEntryForm(){
  ["entryYear","entryLaw","safetyFrom","safetyTo","safetyCount","safetyMoney","safetyCancelCount","safetyCancelNo",
   "receiptFrom","receiptTo","receiptCount","receiptMoney","receiptCancelCount","receiptCancelNo",
   "appBookNo","appFrom","appTo","appCount","appMoney","appCancelCount","appCancelNo",
   "tradeFrom","tradeTo","tradeCount","tradeMoney","tradeCancelCount","tradeCancelNo",
   "govCount","govMoney","entryNote","entryPn","entryEdc"].forEach(id=>{if($(id)) $(id).value="";});
  clearThaiDatePicker("entryDate"); clearThaiDatePicker("entrySent");
  const date=$("entryDate");
  const year=$("entryYear");
  if(date && year){ year.value=""; }
  updateEntryFormForChannel();
}

async function addDailyEntry(){
  const dateInput=clean($("entryDate").value), sentInput=clean($("entrySent").value);
  const date=parseUserDate(dateInput), sent=sentInput?parseUserDate(sentInput):"";
  if(!date){alert("กรุณาเลือกวันที่ชำระ");return;}
  if(sentInput&&!sent){alert("กรุณาเลือกวันที่ส่ง");return;}

  const sc=num($("safetyCount")?.value), sm=num($("safetyMoney")?.value), scc=num($("safetyCancelCount")?.value);
  const rc=num($("receiptCount")?.value), rm=num($("receiptMoney")?.value), rcc=num($("receiptCancelCount")?.value);
  const ac=num($("appCount")?.value), am=num($("appMoney")?.value), acc=num($("appCancelCount")?.value);
  const tc=num($("tradeCount")?.value), tm=num($("tradeMoney")?.value), tcc=num($("tradeCancelCount")?.value);
  const gc=num($("govCount")?.value), gm=num($("govMoney")?.value);
  const active = ENTRY_FIELDS_BY_CHANNEL[activeEntryChannel] || [];
  const relevant={
    safety:[sc,sm,scc,clean($("safetyFrom")?.value),clean($("safetyTo")?.value),clean($("safetyCancelNo")?.value)],
    receipt:[rc,rm,rcc,clean($("receiptFrom")?.value),clean($("receiptTo")?.value),clean($("receiptCancelNo")?.value)],
    app:[ac,am,acc,clean($("appBookNo")?.value),clean($("appFrom")?.value),clean($("appTo")?.value),clean($("appCancelNo")?.value)],
    trade:[tc,tm,tcc,clean($("tradeFrom")?.value),clean($("tradeTo")?.value),clean($("tradeCancelNo")?.value)],
    gov:[gc,gm]
  };
  const hasAny=active.some(section=>relevant[section].some(v=>typeof v==="number"?v!==0:!!v));
  if(!hasAny){alert("กรุณากรอกข้อมูลของช่องทางนี้อย่างน้อย 1 รายการ");return;}

  const entry={
    id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),
    channel:activeEntryChannel,date,year:fiscalYearFromDate(date),month:monthFromDate(date),law:clean($("entryLaw")?.value),sent,
    safetyFrom:clean($("safetyFrom")?.value),safetyTo:clean($("safetyTo")?.value),safetyCount:sc,safetyMoney:sm,safetyCancelCount:scc,safetyCancelNo:clean($("safetyCancelNo")?.value),
    receiptFrom:clean($("receiptFrom")?.value),receiptTo:clean($("receiptTo")?.value),receiptCount:rc,receiptMoney:rm,receiptCancelCount:rcc,receiptCancelNo:clean($("receiptCancelNo")?.value),
    appBookNo:clean($("appBookNo")?.value),appFrom:clean($("appFrom")?.value),appTo:clean($("appTo")?.value),appCount:ac,appMoney:am,appCancelCount:acc,appCancelNo:clean($("appCancelNo")?.value),
    tradeFrom:clean($("tradeFrom")?.value),tradeTo:clean($("tradeTo")?.value),tradeCount:tc,tradeMoney:tm,tradeCancelCount:tcc,tradeCancelNo:clean($("tradeCancelNo")?.value),
    govCount:gc,govMoney:gm,note:clean($("entryNote")?.value),pn:clean($("entryPn")?.value),edc:clean($("entryEdc")?.value)
  };
  try{
    if(cloudReady) await cloudInsertEntry(entry);
    const entries=getManualEntries().concat(entry);
    saveManualEntries(entries);
    setData(excelCacheRows,"update.xlsx");
    resetEntryForm();
    renderEntryTable();
    renderSummary();
    alert(cloudReady?"บันทึกข้อมูลลง Cloud เรียบร้อยแล้ว":"บันทึกข้อมูลไว้ในเครื่องนี้แล้ว");
  }catch(e){console.error(e);alert("บันทึกข้อมูลไม่สำเร็จ: "+e.message);}
}

function renderEntryTable(){
  const el=$("entryTable"); if(!el)return;
  // Apply the same year/month/channel selectors shown above the saved-data table.
  // This prevents older records from remaining visible after a month/year is selected.
  const filterYear=clean($("entryDownloadYear")?.value);
  const filterMonth=clean($("entryDownloadMonth")?.value);
  const filterChannel=clean($("entryDownloadChannel")?.value);
  const filterLaw=clean($("entryDownloadLaw")?.value);
  const entries=getManualEntries().filter(e=>{
    const ec=e.channel||"ธนาคาร";
    return (!filterYear||clean(e.year)===filterYear) &&
           (!filterMonth||clean(e.month)===filterMonth) &&
           (filterChannel ? ec===filterChannel : ec===activeEntryChannel) && (!filterLaw || clean(e.law)===filterLaw);
  }).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const cols={
    "ศบธ.":[
      ["วันที่ชำระ",e=>displayDate(e.date)],["Safety จาก",e=>e.safetyFrom],["Safety ถึง",e=>e.safetyTo],["Safety ใบเสร็จ",e=>totalSafetyCount(e)],["Safety บาท",e=>totalSafetyMoney(e)],["Safety ยกเลิก",e=>e.safetyCancelCount],["Safety เลขที่ยกเลิก",e=>e.safetyCancelNo],
      ["Receipt จาก",e=>e.receiptFrom],["Receipt ถึง",e=>e.receiptTo],["Receipt ใบเสร็จ",e=>totalReceiptCount(e)],["Receipt บาท",e=>totalReceiptMoney(e)],["Receipt ยกเลิก",e=>e.receiptCancelCount],["Receipt เลขที่ยกเลิก",e=>e.receiptCancelNo],
      ["Trade จาก",e=>e.tradeFrom],["Trade ถึง",e=>e.tradeTo],["Trade ใบเสร็จ",e=>totalTradeCount(e)],["Trade บาท",e=>totalTradeMoney(e)],["Trade ยกเลิก",e=>e.tradeCancelCount],["Trade เลขที่ยกเลิก",e=>e.tradeCancelNo],
      ["นำรายได้ ใบเสร็จ",e=>e.govCount],["นำรายได้ บาท",e=>e.govMoney],["หมายเหตุ",e=>e.note],["พน0401.1/",e=>e.pn],["EDC",e=>e.edc],["วันที่ส่ง",e=>displayDate(e.sent)]
    ],
    "ธนาคาร":[
      ["วันที่ชำระ",e=>displayDate(e.date)],["Safety จาก",e=>e.safetyFrom],["Safety ถึง",e=>e.safetyTo],["Safety ใบเสร็จ",e=>totalSafetyCount(e)],["Safety บาท",e=>totalSafetyMoney(e)],["Safety ยกเลิก",e=>e.safetyCancelCount],["Safety เลขที่ยกเลิก",e=>e.safetyCancelNo],
      ["Receipt จาก",e=>e.receiptFrom],["Receipt ถึง",e=>e.receiptTo],["Receipt ใบเสร็จ",e=>totalReceiptCount(e)],["Receipt บาท",e=>totalReceiptMoney(e)],["Receipt ยกเลิก",e=>e.receiptCancelCount],["Receipt เลขที่ยกเลิก",e=>e.receiptCancelNo],
      ["Trade จาก",e=>e.tradeFrom],["Trade ถึง",e=>e.tradeTo],["Trade ใบเสร็จ",e=>totalTradeCount(e)],["Trade บาท",e=>totalTradeMoney(e)],["Trade ยกเลิก",e=>e.tradeCancelCount],["Trade เลขที่ยกเลิก",e=>e.tradeCancelNo],
      ["หมายเหตุ",e=>e.note],["พน0401.1/",e=>e.pn],["วันที่ส่ง",e=>displayDate(e.sent)]
    ],
    "ไปรษณีย์":[
      ["วันที่ชำระ",e=>displayDate(e.date)],["Receipt จาก",e=>e.receiptFrom],["Receipt ถึง",e=>e.receiptTo],["Receipt ใบเสร็จ",e=>totalReceiptCount(e)],["Receipt บาท",e=>totalReceiptMoney(e)],["Receipt ยกเลิก",e=>e.receiptCancelCount],["Receipt เลขที่ยกเลิก",e=>e.receiptCancelNo],
      ["App หมายเลขเล่ม",e=>e.appBookNo],["App จาก",e=>e.appFrom],["App ถึง",e=>e.appTo],["App ใบเสร็จ",e=>e.appCount],["App บาท",e=>e.appMoney],["App ยกเลิก",e=>e.appCancelCount],["App เลขที่ยกเลิก",e=>e.appCancelNo],
      ["Trade จาก",e=>e.tradeFrom],["Trade ถึง",e=>e.tradeTo],["Trade ใบเสร็จ",e=>totalTradeCount(e)],["Trade บาท",e=>totalTradeMoney(e)],["Trade ยกเลิก",e=>e.tradeCancelCount],["Trade เลขที่ยกเลิก",e=>e.tradeCancelNo],
      ["หมายเหตุ",e=>e.note],["พน0401.1/",e=>e.pn],["วันที่ส่ง",e=>displayDate(e.sent)]
    ],
    "เคาน์เตอร์เซอร์วิส":[
      ["วันที่ชำระ",e=>displayDate(e.date)],["Trade จาก",e=>e.tradeFrom],["Trade ถึง",e=>e.tradeTo],["Trade ใบเสร็จ",e=>totalTradeCount(e)],["Trade บาท",e=>totalTradeMoney(e)],["Trade ยกเลิก",e=>e.tradeCancelCount],["Trade เลขที่ยกเลิก",e=>e.tradeCancelNo],
      ["หมายเหตุ",e=>e.note],["พน0401.1/",e=>e.pn],["วันที่ส่ง",e=>displayDate(e.sent)]
    ]
  }[activeEntryChannel] || [];
  let html="<thead><tr><th>ช่องทาง</th>"+cols.map(c=>`<th>${esc(c[0])}</th>`).join("")+"<th>จัดการ</th></tr></thead><tbody>";
  if(!entries.length) html+=`<tr><td colspan="${cols.length+2}" class="empty-cell">ยังไม่มีข้อมูลที่ป้อนเองสำหรับช่องทาง ${esc(ENTRY_CHANNELS[activeEntryChannel]?.label||activeEntryChannel)}</td></tr>`;
  else entries.forEach((e,i)=>{
    html+=`<tr><td>${esc(ENTRY_CHANNELS[e.channel||activeEntryChannel]?.label||e.channel||activeEntryChannel)}</td>`+
      cols.map(c=>{const v=c[1](e);const numeric=typeof v==="number";return `<td class="${numeric?"num-cell":""}">${esc(numeric?v.toLocaleString("th-TH",{maximumFractionDigits:2}):v||"")}</td>`}).join("")+
      `<td><button class="delete-entry" data-id="${esc(e.id)}">ลบ</button></td></tr>`;
  });
  html+="</tbody>"; el.innerHTML=html;
  el.querySelectorAll(".delete-entry").forEach(btn=>btn.addEventListener("click",async ()=>{
    const id=btn.dataset.id, all=getManualEntries(), target=all.find(x=>x.id===id);
    if(!target)return;
    if(confirm(`ต้องการลบข้อมูลวันที่ ${displayDate(target.date)} ใช่หรือไม่?`)){
      try{
        if(cloudReady) await cloudDeleteEntry(target.id);
        const remaining=all.filter(x=>x.id!==target.id);
        saveManualEntries(remaining);setData(excelCacheRows,"update.xlsx");renderEntryTable();renderSummary();
      }catch(e){alert("ลบข้อมูลไม่สำเร็จ: "+e.message);}
    }
  }));
}

function summaryRows(){
  const entries=getManualEntries(); const y=clean($("summaryYear")?.value), m=clean($("summaryMonth")?.value);
  return entries.filter(e=>(!y||e.year===y)&&(!m||e.month===m));
}
function renderSummary(){
  if(!$("summaryTable"))return;
  const entries=getManualEntries();
  const years=[...new Set(entries.map(e=>clean(e.year)).filter(Boolean))].sort();
  const sy=clean($("summaryYear")?.value), sm=clean($("summaryMonth")?.value), filteredEntries=summaryRows();
  const yearEl=$("summaryYear"); if(yearEl){const old=yearEl.value;yearEl.innerHTML='<option value="">ทุกปี</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");if(years.includes(old))yearEl.value=old;}
  const monthEl=$("summaryMonth"); if(monthEl){const months=orderedMonths(filteredEntries.map(e=>e.month));const old=monthEl.value;monthEl.innerHTML='<option value="">ทุกเดือน</option>'+months.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");if(months.includes(old))monthEl.value=old;}
  $("sumRows").textContent=filteredEntries.length.toLocaleString("th-TH");
  $("sumCount").textContent=filteredEntries.reduce((a,e)=>a+reportTotalCount(e),0).toLocaleString("th-TH");
  $("sumMoney").textContent=filteredEntries.reduce((a,e)=>a+reportTotalMoney(e),0).toLocaleString("th-TH",{maximumFractionDigits:2});
  $("sumDays").textContent=new Set(filteredEntries.map(e=>e.date).filter(Boolean)).size.toLocaleString("th-TH");
  const groups={};
  filteredEntries.forEach(e=>{const key=`${e.year}|${e.month}`;if(!groups[key])groups[key]={year:e.year,month:e.month,days:new Set(),safetyCount:0,safetyMoney:0,receiptCount:0,receiptMoney:0,appCount:0,appMoney:0,tradeCount:0,tradeMoney:0,govCount:0,govMoney:0};groups[key].days.add(e.date);groups[key].receiptCount+=totalReceiptCount(e);groups[key].receiptMoney+=totalReceiptMoney(e);groups[key].appCount+=totalAppCount(e);groups[key].appMoney+=totalAppMoney(e);groups[key].tradeCount+=totalTradeCount(e);groups[key].tradeMoney+=totalTradeMoney(e);groups[key].govCount+=totalGovCount(e);groups[key].govMoney+=totalGovMoney(e);});
  const arr=Object.values(groups).sort((a,b)=>String(a.year).localeCompare(String(b.year))||MONTHS.indexOf(a.month)-MONTHS.indexOf(b.month));
  let html='<thead><tr><th>ปีงบประมาณ</th><th>เดือน</th><th>จำนวนวันที่มีข้อมูล</th><th>Safety ใบเสร็จ</th><th>Safety บาท</th><th>Receipt ใบเสร็จ</th><th>Receipt บาท</th><th>App ใบเสร็จ</th><th>App บาท</th><th>Trade ใบเสร็จ</th><th>Trade บาท</th><th>นำรายได้ ใบเสร็จ</th><th>นำรายได้ บาท</th><th>รวมใบเสร็จ</th><th>รวมเงิน</th></tr></thead><tbody>';
  if(!arr.length)html+='<tr><td colspan="15" class="empty-cell">ยังไม่มีข้อมูลตามตัวกรอง</td></tr>';
  arr.forEach(g=>{const totalC=g.safetyCount+g.receiptCount+g.appCount+g.tradeCount+g.govCount,totalM=g.safetyMoney+g.receiptMoney+g.appMoney+g.tradeMoney+g.govMoney;html+=`<tr><td>${esc(g.year)}</td><td>${esc(g.month)}</td><td>${g.days.size.toLocaleString("th-TH")}</td><td>${g.safetyCount.toLocaleString("th-TH")}</td><td>${g.safetyMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.receiptCount.toLocaleString("th-TH")}</td><td>${g.receiptMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.appCount.toLocaleString("th-TH")}</td><td>${g.appMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.tradeCount.toLocaleString("th-TH")}</td><td>${g.tradeMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.govCount.toLocaleString("th-TH")}</td><td>${g.govMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td><b>${totalC.toLocaleString("th-TH")}</b></td><td><b>${totalM.toLocaleString("th-TH",{minimumFractionDigits:2})}</b></td></tr>`;});
  html+='</tbody>'; $("summaryTable").innerHTML=html;
}

async function exportSummaryExcelGrid(entries,fileName,title,filterText,selectedYear="",selectedMonth=""){
  if(!window.ExcelJS){ alert("ระบบ Excel ยังโหลดไม่เสร็จ กรุณาลองใหม่อีกครั้ง"); return; }

  const wb=new ExcelJS.Workbook();
  wb.creator="Fee Dashboard";
  wb.created=new Date();

  // -------------------- ชีทเดิม: สรุปรายเดือน/ปี --------------------
  const summarySheet=wb.addWorksheet("สรุปรายเดือน-ปี");
  const groups={};
  entries.forEach(e=>{
    const year=clean(e.year)||clean(fiscalYearFromDate(e.date));
    const month=clean(e.month)||monthFromDate(e.date);
    const key=`${year}|${month}`;
    if(!groups[key]) groups[key]={year,month,days:new Set(),safetyCount:0,safetyMoney:0,receiptCount:0,receiptMoney:0,appCount:0,appMoney:0,tradeCount:0,tradeMoney:0,govCount:0,govMoney:0};
    const g=groups[key];
    if(e.date) g.days.add(e.date);
    g.safetyCount+=totalSafetyCount(e); g.safetyMoney+=totalSafetyMoney(e);
    g.receiptCount+=totalReceiptCount(e); g.receiptMoney+=totalReceiptMoney(e);
    g.appCount+=totalAppCount(e); g.appMoney+=totalAppMoney(e);
    g.tradeCount+=totalTradeCount(e); g.tradeMoney+=totalTradeMoney(e);
    g.govCount+=totalGovCount(e); g.govMoney+=totalGovMoney(e);
  });
  const arr=Object.values(groups).sort((a,b)=>{
    const y=String(a.year).localeCompare(String(b.year));
    return y || MONTHS.indexOf(a.month)-MONTHS.indexOf(b.month);
  });

  summarySheet.mergeCells("A1:P1");
  summarySheet.getCell("A1").value=title;
  summarySheet.mergeCells("A2:P2");
  summarySheet.getCell("A2").value=`${filterText} • ${entries.length.toLocaleString("th-TH")} รายการ`;
  summarySheet.getRow(1).height=28;
  summarySheet.getRow(2).height=22;

  const summaryHeaders=["ลำดับ","ปีงบประมาณ","เดือน","จำนวนวันที่มีข้อมูล","Safety ใบเสร็จ","Safety บาท","Receipt ใบเสร็จ","Receipt บาท","App ใบเสร็จ","App บาท","Trade ใบเสร็จ","Trade บาท","นำรายได้ ใบเสร็จ","นำรายได้ บาท","รวมใบเสร็จ","รวมเงิน"];
  summarySheet.addRow([]);
  summarySheet.addRow(summaryHeaders);
  const headerRow=summarySheet.getRow(4);
  headerRow.height=36;
  headerRow.eachCell(cell=>{
    cell.font={name:"TH SarabunPSK",size:16,bold:true};
    cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};
  });

  let rowNo=5;
  arr.forEach((g,i)=>{
    const totalC=g.safetyCount+g.receiptCount+g.appCount+g.tradeCount+g.govCount;
    const totalM=g.safetyMoney+g.receiptMoney+g.appMoney+g.tradeMoney+g.govMoney;
    summarySheet.addRow([i+1,g.year,g.month,g.days.size,g.safetyCount,g.safetyMoney,g.receiptCount,g.receiptMoney,g.appCount,g.appMoney,g.tradeCount,g.tradeMoney,g.govCount,g.govMoney,totalC,totalM]);
    rowNo++;
  });
  const totals=arr.reduce((a,g)=>{
    a.days+=g.days.size; a.sc+=g.safetyCount; a.sm+=g.safetyMoney; a.rc+=g.receiptCount; a.rm+=g.receiptMoney;
    a.ac+=g.appCount; a.am+=g.appMoney; a.tc+=g.tradeCount; a.tm+=g.tradeMoney; a.gc+=g.govCount; a.gm+=g.govMoney;
    return a;
  },{days:0,sc:0,sm:0,rc:0,rm:0,ac:0,am:0,tc:0,tm:0,gc:0,gm:0});
  const totalC=totals.sc+totals.rc+totals.ac+totals.tc+totals.gc;
  const totalM=totals.sm+totals.rm+totals.am+totals.tm+totals.gm;
  summarySheet.addRow(["","","รวมทั้งหมด",totals.days,totals.sc,totals.sm,totals.rc,totals.rm,totals.ac,totals.am,totals.tc,totals.tm,totals.gc,totals.gm,totalC,totalM]);

  summarySheet.columns=[
    {width:9},{width:14},{width:16},{width:18},{width:16},{width:16},{width:17},{width:16},
    {width:14},{width:16},{width:15},{width:16},{width:18},{width:16},{width:15},{width:16}
  ];
  summarySheet.eachRow({includeEmpty:true},(row,r)=>{
    row.eachCell({includeEmpty:true},cell=>{
      cell.font={...cell.font,name:"TH SarabunPSK",size:16};
      cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};
      cell.alignment={vertical:"middle"};
    });
    if(r>=5){
      row.getCell(1).alignment={horizontal:"center",vertical:"middle"};
      for(let c=4;c<=16;c++) row.getCell(c).numFmt=(c%2===0 && c>=6) ? '#,##0.00' : (c>=4 ? '#,##0' : 'General');
    }
  });
  const grandRow=summarySheet.getRow(summarySheet.rowCount);
  grandRow.font={name:"TH SarabunPSK",size:16,bold:true};
  grandRow.alignment={vertical:"middle"};
  summarySheet.freezePanes={xSplit:0,ySplit:4};

  // -------------------- ชีทใหม่: สรุป พ.ร.บ. --------------------
  // รูปแบบชีทนี้ทำตามตารางตัวอย่าง: 5 คอลัมน์
  // A = กฎหมาย, B = ศูนย์บริการธุรกิจพลังงาน, C = ไปรษณีย์, D = ธนาคาร, E = รวม
  // พ.ร.บ. 42 = Safety + Receipt และ พ.ร.บ. 43 = Trade
  const lawSheet=wb.addWorksheet("สรุป พ.ร.บ.");
  const thaiDigits=s=>String(s??"").replace(/[0-9]/g,d=>"๐๑๒๓๔๕๖๗๘๙"[Number(d)]);
  const fy=clean(selectedYear)||"ทุกปี";
  const sm=clean(selectedMonth)||"ทุกเดือน";
  let calendarYear="";
  if(fy!=="ทุกปี" && sm!=="ทุกเดือน"){
    const n=MONTHS.indexOf(sm)+1;
    calendarYear=String(Number(fy)-(n>=10?1:0));
  }else if(fy!=="ทุกปี"){
    calendarYear=String(Number(fy));
  }
  const fiscalTitle=fy==="ทุกปี" ? "ประจำปีงบประมาณ ทุกปี" : `ประจำปีงบประมาณ ${thaiDigits(fy)}`;
  const monthTitle=sm==="ทุกเดือน" ? "ประจำเดือน ทุกเดือน" : `ประจำเดือน ${sm}${calendarYear?` ${thaiDigits(calendarYear)}`:""}`;

  lawSheet.mergeCells("A1:E1");
  lawSheet.getCell("A1").value="กรมธุรกิจพลังงาน";
  lawSheet.mergeCells("A2:E2");
  lawSheet.getCell("A2").value=`สรุปข้อมูลการชำระค่าธรรมเนียม ${fiscalTitle}`;
  lawSheet.mergeCells("A3:E3");
  lawSheet.getCell("A3").value=monthTitle;
  [1,2,3].forEach(r=>{
    lawSheet.getRow(r).height=26;
    lawSheet.getCell(`A${r}`).font={name:"TH SarabunPSK",size:r===1?18:16,bold:true};
    lawSheet.getCell(`A${r}`).alignment={horizontal:"center",vertical:"middle"};
  });

  const channelKeys=[
    ["ศบธ.","ศูนย์บริการธุรกิจพลังงาน"],
    ["ไปรษณีย์","บริษัท ไปรษณีย์ไทย จำกัด"],
    ["ธนาคาร","ธนาคารกรุงไทย จำกัด (มหาชน)"]
  ];

  const calc=(law,key)=>{
    const list=entries.filter(e=>(e.channel||"ธนาคาร")===key);
    if(law==="43"){
      return {
        count:list.reduce((s,e)=>s+totalTradeCount(e),0),
        money:list.reduce((s,e)=>s+totalTradeMoney(e),0)
      };
    }
    return {
      count:list.reduce((s,e)=>s+totalSafetyCount(e)+totalReceiptCount(e),0),
      money:list.reduce((s,e)=>s+totalSafetyMoney(e)+totalReceiptMoney(e),0)
    };
  };

  // หัวตารางแบบรูปตัวอย่าง: ช่องทาง / กฎหมายอยู่ในช่องทแยงมุมเดียวกัน
  lawSheet.mergeCells("A5:A6");
  lawSheet.getCell("A5").value="ช่องทาง\nกฎหมาย";
  lawSheet.getCell("A5").alignment={horizontal:"center",vertical:"middle",wrapText:true};
  lawSheet.getCell("B5").value="ศูนย์บริการธุรกิจ\nพลังงาน";
  lawSheet.getCell("C5").value="บริษัท ไปรษณีย์ไทย\nจำกัด";
  lawSheet.getCell("D5").value="ธนาคารกรุงไทย\nจำกัด (มหาชน)";
  lawSheet.getCell("E5").value="รวม";
  lawSheet.mergeCells("B5:B6");
  lawSheet.mergeCells("C5:C6");
  lawSheet.mergeCells("D5:D6");
  lawSheet.mergeCells("E5:E6");

  for(let r=5;r<=6;r++){
    lawSheet.getRow(r).height=30;
    lawSheet.getRow(r).eachCell({includeEmpty:true},cell=>{
      cell.font={name:"TH SarabunPSK",size:16,bold:true};
      cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
      cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};
    });
  }
  // เส้นทแยงในหัวช่อง กฎหมาย/ช่องทาง ให้ใกล้เคียงภาพตัวอย่าง
  lawSheet.getCell("A5").border={
    top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"},
    diagonal:{style:"thin"},diagonalUp:true
  };

  const lawRows=[["42","๑. พ.ร.บ. 2542"],["43","๒. พ.ร.บ. 2543"]];
  let rr=7;
  const grand={43:{count:0,money:0},42:{count:0,money:0}};

  lawRows.forEach(([law,label])=>{
    const values=channelKeys.map(([key])=>calc(law,key));
    const countTotal=values.reduce((s,v)=>s+v.count,0);
    const moneyTotal=values.reduce((s,v)=>s+v.money,0);
    grand[law]={count:countTotal,money:moneyTotal};

    lawSheet.getCell(`A${rr}`).value=`${label} (ราย)`;
    lawSheet.getCell(`A${rr+1}`).value="(บาท)";
    values.forEach((v,i)=>{
      lawSheet.getCell(rr,2+i).value=v.count;
      lawSheet.getCell(rr+1,2+i).value=v.money;
    });
    lawSheet.getCell(rr,5).value=countTotal;
    lawSheet.getCell(rr+1,5).value=moneyTotal;
    rr+=2;
  });

  lawSheet.getCell(`A${rr}`).value="รวม (ราย)";
  lawSheet.getCell(`A${rr+1}`).value="(บาท)";
  channelKeys.forEach((item,i)=>{
    const c=2+i;
    const count=grand["43"].count && 0; // คำนวณแยกตามช่องทางด้านล่าง
    const v43=calc("43",item[0]);
    const v42=calc("42",item[0]);
    lawSheet.getCell(rr,c).value=v43.count+v42.count;
    lawSheet.getCell(rr+1,c).value=v43.money+v42.money;
  });
  lawSheet.getCell(rr,5).value=grand["43"].count+grand["42"].count;
  lawSheet.getCell(rr+1,5).value=grand["43"].money+grand["42"].money;

  lawSheet.columns=[
    {width:27},{width:23},{width:29},{width:31},{width:20}
  ];
  lawSheet.eachRow({includeEmpty:true},(row,r)=>{
    row.eachCell({includeEmpty:true},cell=>{
      cell.font={...cell.font,name:"TH SarabunPSK",size:16};
      cell.border={top:{style:"thin"},left:{style:"thin"},bottom:{style:"thin"},right:{style:"thin"}};
      cell.alignment={vertical:"middle",wrapText:true};
    });
    if(r>=7){
      row.getCell(1).alignment={horizontal:"right",vertical:"middle",wrapText:true};
      for(let c=2;c<=5;c++){
        row.getCell(c).alignment={horizontal:"right",vertical:"middle"};
        row.getCell(c).numFmt=(r%2===1)?'#,##0':'#,##0.00';
      }
    }
  });
  lawSheet.getRow(rr).font={name:"TH SarabunPSK",size:16,bold:true};
  lawSheet.getRow(rr+1).font={name:"TH SarabunPSK",size:16,bold:true};
  lawSheet.freezePanes={xSplit:1,ySplit:6};

  applyThaiSarabunFont(wb);
  const out=await wb.xlsx.writeBuffer();
  const xlsxName=String(fileName).replace(/\.xls$/i,".xlsx");
  const blob=new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=xlsxName;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
}

function reportCell(v, cls=""){ return `<td class="${cls}">${esc(v)}</td>`; }
function reportNum(v){ return Number(v||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function exportDailyReportExcel(entries,fileName,title){
  const body=entries.map(e=>`<tr>
    ${reportCell(displayDate(e.date),"date")}
    ${reportCell(e.safetyFrom)}${reportCell(e.safetyTo)}${reportCell(e.safetyCount,"num-int")}${reportCell(reportNum(e.safetyMoney),"num")}${reportCell(e.safetyCancelCount,"num-int")}
    ${reportCell(e.receiptFrom)}${reportCell(e.receiptTo)}${reportCell(e.receiptCount,"num-int")}${reportCell(reportNum(e.receiptMoney),"num")}${reportCell(e.receiptCancelCount,"num-int")}${reportCell(e.receiptCancelNo)}
    ${reportCell(e.tradeFrom)}${reportCell(e.tradeTo)}${reportCell(e.tradeCount,"num-int")}${reportCell(reportNum(e.tradeMoney),"num")}${reportCell(e.tradeCancelCount,"num-int")}${reportCell(e.tradeCancelNo)}
    ${reportCell(e.govCount,"num-int")}${reportCell(reportNum(e.govMoney),"num")}
    ${reportCell(e.note)}${reportCell(e.pn)}${reportCell(displayDate(e.sent),"date")}
  </tr>`).join("");
  const totals=entries.reduce((a,e)=>{a.sc+=totalSafetyCount(e);a.sm+=totalSafetyMoney(e);a.scc+=totalSafetyCancelCount(e);a.rc+=totalReceiptCount(e);a.rm+=totalReceiptMoney(e);a.rcc+=num(e.receiptCancelCount);a.tc+=totalTradeCount(e);a.tm+=totalTradeMoney(e);a.tcc+=num(e.tradeCancelCount);a.gc+=totalGovCount(e);a.gm+=totalGovMoney(e);a.totalc+=reportTotalCount(e);a.totalm+=reportTotalMoney(e);return a;},{sc:0,sm:0,scc:0,rc:0,rm:0,rcc:0,tc:0,tm:0,tcc:0,gc:0,gm:0,totalc:0,totalm:0});
  const totalRow=`<tr class="total-row"><td class="center"><b>รวม</b></td><td></td><td></td><td class="num-int"><b>${totals.sc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.sm)}</b></td><td class="num-int"><b>${totals.scc.toLocaleString("th-TH")}</b></td><td></td><td></td><td class="num-int"><b>${totals.rc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.rm)}</b></td><td class="num-int"><b>${totals.rcc.toLocaleString("th-TH")}</b></td><td></td><td></td><td class="num-int"><b>${totals.tc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.tm)}</b></td><td class="num-int"><b>${totals.tcc.toLocaleString("th-TH")}</b></td><td></td><td class="num-int"><b>${totals.gc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.gm)}</b></td><td></td><td></td><td></td></tr>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt;color:#17283b}table,th,td{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt}h1{text-align:center;font-size:16pt;margin:0 0 12px}.meta{text-align:center;margin-bottom:12px;color:#555}
  table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #333;padding:6px 5px;vertical-align:middle;word-wrap:break-word}th{text-align:center;font-weight:bold} .blue{background:#a9ddec}.safety{background:#f4df8c}.receipt{background:#f3b36e}.trade{background:#f3aab8}.gov{background:#d9e8a5}.purple{background:#b7a9d8}.plainblue{background:#9ecbe4}
  .center{text-align:center}.num,.num-int{text-align:right}.num{mso-number-format:"#,##0.00"}.num-int{mso-number-format:"#,##0"}.date{text-align:center}.total-row td{font-weight:bold;background:#f4f6f8}
  col.date{width:85px}col.narrow{width:72px}col.money{width:90px}col.note{width:120px}col.pn{width:75px}col.sent{width:85px}
  </style></head><body>
  <h1>${esc(title)}</h1><div class="meta">ข้อมูลที่ป้อนจากระบบ Dashboard • ${entries.length.toLocaleString("th-TH")} รายการ</div>
  <table><colgroup><col class="date"><col><col><col class="narrow"><col class="money"><col class="narrow"><col><col><col class="narrow"><col class="money"><col class="narrow"><col><col><col><col class="narrow"><col class="money"><col class="narrow"><col><col class="narrow"><col class="money"><col class="note"><col class="pn"><col class="sent"></colgroup>
  <thead><tr><th rowspan="2" class="blue">วันที่ชำระ</th><th colspan="5" class="safety">ระบบ Safety</th><th colspan="6" class="receipt">ระบบ Receipt (ใบเสร็จรับเงิน A4)</th><th colspan="6" class="trade">ระบบ Trade</th><th colspan="2" class="gov">นำรายได้ ส่ง กค.<br>พรบ.42 + พรบ.43</th><th rowspan="2" class="purple">หมายเหตุ</th><th rowspan="2" class="plainblue">พน0401.1/</th><th rowspan="2" class="plainblue">วันที่ส่ง</th></tr>
  <tr><th class="safety">จาก</th><th class="safety">ถึง</th><th class="safety">จำนวนใบเสร็จ</th><th class="safety">จำนวนเงิน</th><th class="safety">ยกเลิกใบเสร็จ<br>จำนวนใบเสร็จที่ยกเลิก</th><th class="receipt">จาก</th><th class="receipt">ถึง</th><th class="receipt">จำนวนใบเสร็จ</th><th class="receipt">จำนวนเงิน</th><th class="receipt">ยกเลิก/และสูญเสีย<br>จำนวนใบเสร็จ</th><th class="receipt">เลขที่ใบเสร็จ</th><th class="trade">จาก</th><th class="trade">ถึง</th><th class="trade">จำนวนใบเสร็จ</th><th class="trade">จำนวนเงิน</th><th class="trade">ยกเลิก/และสูญเสีย<br>จำนวนใบเสร็จ</th><th class="trade">เลขที่ใบเสร็จ</th><th class="gov">จำนวนใบเสร็จ</th><th class="gov">จำนวนเงิน</th></tr></thead>
  <tbody>${body}${totalRow}</tbody></table></body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fileName;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}

function refreshEntryDownloadFilters(){
  // ปี/เดือนต้องเลือกได้ก่อน โดยไม่บังคับให้เลือกวิธีการชำระก่อน
  // ช่องทางเป็นเพียงตัวกรองเพิ่มเติมเท่านั้น
  const all=getManualEntries();
  const yEl=$("entryDownloadYear"), mEl=$("entryDownloadMonth"), lEl=$("entryDownloadLaw"), cEl=$("entryDownloadChannel");
  if(!yEl || !mEl)return;
  const oldY=yEl.value, oldM=mEl.value, oldL=lEl?.value||"", oldC=cEl?.value||"";

  const years=[...new Set(all.map(e=>clean(e.year)||clean(fiscalYearFromDate(e.date))).filter(Boolean))]
    .sort((a,b)=>Number(a)-Number(b));
  yEl.innerHTML='<option value="">ทุกปี</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");
  if(years.includes(oldY)) yEl.value=oldY;

  // สำคัญ: เดือนคำนวณจาก "ปี" เท่านั้น ไม่ผูกกับช่องทาง
  const yearFiltered=all.filter(e=>{
    const ey=clean(e.year)||clean(fiscalYearFromDate(e.date));
    return !yEl.value || ey===yEl.value;
  });
  const months=orderedMonths(yearFiltered.map(e=>clean(e.month)||monthFromDate(e.date)));
  mEl.innerHTML='<option value="">ทุกเดือน</option>'+months.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("");
  if(months.includes(oldM)) mEl.value=oldM;
  else mEl.value="";
  if(lEl){
    const laws=[...new Set(all.map(e=>clean(e.law)).filter(Boolean))].sort();
    lEl.innerHTML='<option value="">ทุกกฎหมาย</option>'+laws.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join("");
    if(laws.includes(oldL)) lEl.value=oldL;
  }
  if(cEl) cEl.value=oldC;
}

function renderEntryTableWithDownloadFilter(){
  const all=getManualEntries();
  const y=clean($("entryDownloadYear")?.value), m=clean($("entryDownloadMonth")?.value), l=clean($("entryDownloadLaw")?.value), ch=clean($("entryDownloadChannel")?.value);
  const filtered=all.filter(e=>{const ec=e.channel||"ธนาคาร";return (!y||clean(e.year)===y)&&(!m||clean(e.month)===m)&&(!l||clean(e.law)===l)&&(!ch||ec===ch);}).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  renderEntryTable(filtered);
}

function selectedEntryDownloadRows(channelOverride){
  const y=clean($("entryDownloadYear")?.value), m=clean($("entryDownloadMonth")?.value), l=clean($("entryDownloadLaw")?.value);
  const ch=channelOverride!==undefined ? channelOverride : clean($("entryDownloadChannel")?.value);
  return getManualEntries().filter(e=>{
    const ec=e.channel||"ธนาคาร";
    return (!ch||ec===ch) && (!y||clean(e.year)===y) && (!m||clean(e.month)===m) && (!l||clean(e.law)===l);
  }).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

function colLetter(n){
  let s="";
  while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); }
  return s;
}
function numVal(v){ return num(v); }
function eDate(e){ return e && e.date ? e.date : null; }
function eSent(e){ return e && e.sent ? e.sent : null; }
function set(ws,row,col,value){ ws.getCell(row,col).value = value == null ? null : value; }
function formula(ws,row,col,expr){ ws.getCell(row,col).value = { formula: expr }; }

function summaryMonthLabel(month,year){
  const map={"ตุลาคม":"ต.ค.","พฤศจิกายน":"พ.ย.","ธันวาคม":"ธ.ค.","มกราคม":"ม.ค.","กุมภาพันธ์":"ก.พ.","มีนาคม":"มี.ค.","เมษายน":"เม.ย.","พฤษภาคม":"พ.ค.","มิถุนายน":"มิ.ย.","กรกฎาคม":"ก.ค.","สิงหาคม":"ส.ค.","กันยายน":"ก.ย."};
  const m=map[clean(month)]||clean(month);
  const fy=Number(year||0);
  if(!fy)return m;
  const mn=MONTHS.indexOf(clean(month))+1;
  const buddhistYear=mn>=10?fy-1:fy;
  return `${m}${String(buddhistYear).slice(-2)}`;
}

function findMonthSheet(workbook, selectedMonth){
  const aliases={
    "ตุลาคม":["ต.ค.68","ต.ค. 68"],"พฤศจิกายน":["พ.ย.68","พ.ย. 68"],
    "ธันวาคม":["ธ.ค.68","ธ.ค. 68"],"มกราคม":["ม.ค.69","ม.ค. 69"],
    "กุมภาพันธ์":["ก.พ.69","ก.พ. 69"],"มีนาคม":["มี.ค.69","มี.ค. 69"],
    "เมษายน":["เม.ย.69","เม.ย. 69"],"พฤษภาคม":["พ.ค.69","พ.ค. 69"],
    "มิถุนายน":["มิ.ย.69","มิ.ย. 69"],"กรกฎาคม":["ก.ค.69","ก.ค. 69"],
    "สิงหาคม":["ส.ค.69","ส.ค. 69"],"กันยายน":["ก.ย.69","ก.ย. 69","ก.ย. 69"]
  };
  const wanted=(aliases[clean(selectedMonth)]||[]).map(x=>clean(x).replace(/\s/g,"").replace(/\uFEFF/g,""));
  if(!wanted.length) return null;
  return workbook.worksheets.find(ws=>{
    const n=clean(ws.name).replace(/\s/g,"").replace(/\uFEFF/g,"");
    return wanted.includes(n);
  }) || null;
}

function copyDataRowStyle(ws, targetRow, sourceRow){
  if(!ws || !targetRow) return;
  const src = ws.getRow(sourceRow || Math.max(6, targetRow - 1));
  const dst = ws.getRow(targetRow);
  if(src.height != null) dst.height = src.height;
  dst.hidden = src.hidden;
  dst.outlineLevel = src.outlineLevel;
  for(let c=1; c<=ws.columnCount; c++){
    const sc=src.getCell(c), dc=dst.getCell(c);
    if(sc.style) dc.style = JSON.parse(JSON.stringify(sc.style));
    if(sc.numFmt) dc.numFmt = sc.numFmt;
    if(sc.font) dc.font = JSON.parse(JSON.stringify(sc.font));
    if(sc.fill) dc.fill = JSON.parse(JSON.stringify(sc.fill));
    if(sc.border) dc.border = JSON.parse(JSON.stringify(sc.border));
    if(sc.alignment) dc.alignment = JSON.parse(JSON.stringify(sc.alignment));
    if(sc.protection) dc.protection = JSON.parse(JSON.stringify(sc.protection));
  }
}

function findTotalRow(ws){
  if(!ws) return null;
  for(let r=1; r<=ws.rowCount; r++){
    let found=false;
    ws.getRow(r).eachCell({includeEmpty:false}, cell=>{
      const v=cell.value;
      if(typeof v==='string' && clean(v).replace(/\s/g,'').replace(/:/g,'')==='รวม') found=true;
      if(v && typeof v==='object' && typeof v.text==='string' && clean(v.text).replace(/\s/g,'').replace(/:/g,'')==='รวม') found=true;
    });
    if(found) return r;
  }
  return null;
}

function applyThaiSarabunFont(workbook){
  workbook.eachSheet(ws=>{
    ws.eachRow({includeEmpty:true}, row=>{
      row.eachCell({includeEmpty:true}, cell=>{
        const old=cell.font || {};
        cell.font={...old,name:"TH SarabunPSK"};
      });
    });
  });
}

function initAppNavigation(){
  const links=[...document.querySelectorAll(".side-link")],views=[...document.querySelectorAll(".app-view")];
  function show(id){links.forEach(b=>b.classList.toggle("active",b.dataset.view===id));views.forEach(v=>v.classList.toggle("active-view",v.id===id));if(id==="entryView")renderEntryTable();if(id==="summaryView")renderSummary();window.scrollTo({top:0,behavior:"smooth"});}
  links.forEach(b=>b.addEventListener("click",()=>{show(b.dataset.view);$("sidebar")?.classList.remove("open");}));
  $("mobileMenu")?.addEventListener("click",()=>$("sidebar")?.classList.toggle("open"));
  document.querySelectorAll(".chart-download").forEach(b=>b.addEventListener("click",()=>downloadChart(b.dataset.chart)));
  $("saveEntry")?.addEventListener("click",addDailyEntry); $("clearEntry")?.addEventListener("click",resetEntryForm);
  $("summaryYear")?.addEventListener("change",renderSummary); $("summaryMonth")?.addEventListener("change",renderSummary);
  $("clearSummaryFilter")?.addEventListener("click",()=>{if($("summaryYear"))$("summaryYear").value="";if($("summaryMonth"))$("summaryMonth").value="";renderSummary();});
  $("entryDownloadYear")?.addEventListener("change",()=>{refreshEntryDownloadFilters();renderEntryTable();});
  $("entryDownloadMonth")?.addEventListener("change",()=>{renderEntryTable();});
  $("entryDownloadLaw")?.addEventListener("change",()=>{renderEntryTable();});
  $("entryDownloadChannel")?.addEventListener("change",()=>{refreshEntryDownloadFilters();renderEntryTable();});
  // ดาวน์โหลด Excel ตามแม่แบบต้นฉบับของช่องทางที่เลือก โดยคงเค้าโครง/merge/ความกว้าง/รูปแบบของไฟล์ต้นฉบับ
  async function exportTemplateWorkbook(entries, channelKey, selectedYear, selectedMonth, downloadFile=true){
    if(!window.ExcelJS){ alert("ระบบ Excel ยังโหลดไม่เสร็จ กรุณาลองใหม่อีกครั้ง"); return; }
    const btn=$(downloadFile ? "downloadEntries" : "downloadEntriesMonth");
    const oldText=btn?.textContent;
    if(btn){ btn.disabled=true; btn.textContent="กำลังสร้าง Excel..."; }
    try{
    const cfg=ENTRY_CHANNELS[channelKey]; if(!cfg) return;
    const response=await fetch(`data/templates/${cfg.file}?v=20260922-2`);
    if(!response.ok) throw new Error(`โหลดแม่แบบ ${cfg.template} ไม่สำเร็จ`);
    const buffer=await response.arrayBuffer();
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    wb.calcProperties.fullCalcOnLoad=true; wb.calcProperties.forceFullCalc=true; wb.calcProperties.calcMode="auto";

    const monthAliases={
      "ตุลาคม":["ต.ค.68","ต.ค. 68"],"พฤศจิกายน":["พ.ย.68","พ.ย. 68"],
      "ธันวาคม":["ธ.ค.68","ธ.ค. 68"],"มกราคม":["ม.ค.69","ม.ค. 69"],
      "กุมภาพันธ์":["ก.พ.69","ก.พ. 69"],"มีนาคม":["มี.ค.69","มี.ค. 69"],
      "เมษายน":["เม.ย.69","เม.ย. 69"],"พฤษภาคม":["พ.ค.69","พ.ค. 69"],
      "มิถุนายน":["มิ.ย.69","มิ.ย. 69"],"กรกฎาคม":["ก.ค.69","ก.ค. 69"],
      "สิงหาคม":["ส.ค.69","ส.ค. 69"],"กันยายน":["ก.ย.69","ก.ย. 69","ก.ย. 69"]
    };
    const monthNames=Object.keys(monthAliases);
    let exportYear=clean(selectedYear);
    const selectedEntries=entries.filter(e=>
      (!exportYear || (clean(e.year)||clean(fiscalYearFromDate(e.date)))===exportYear) &&
      (!selectedMonth || clean(e.month||monthFromDate(e.date))===clean(selectedMonth))
    );
    // ถ้าเลือกเดือนแล้วมีข้อมูลอยู่ปีเดียว ให้ใช้ปีนั้นเป็นปีของรายงานโดยอัตโนมัติ
    if(!exportYear){
      const detectedYears=[...new Set(selectedEntries.map(e=>clean(e.year)||clean(fiscalYearFromDate(e.date))).filter(Boolean))];
      if(detectedYears.length===1) exportYear=detectedYears[0];
    }

    const byMonth={}; monthNames.forEach(m=>byMonth[m]=[]);
    selectedEntries.forEach(e=>{const m=clean(e.month)||monthFromDate(e.date);if(byMonth[m])byMonth[m].push(e);});

    // สร้างไฟล์ใหม่ให้มี “ชีทเดือนที่เลือก” เพียงชีทเดียว โดยใช้เค้าโครงเดิมทั้งหมด
    // ถ้าไม่ได้เลือกเดือน จะรวมข้อมูลที่เลือกทั้งหมดไว้ในชีท “ข้อมูลที่เลือก”
    const monthTemplate = selectedMonth ? findMonthSheet(wb, selectedMonth) : wb.worksheets.find(ws=>monthNames.some(m=>{
      const wanted=monthAliases[m].map(x=>clean(x).replace(/\s/g,"").replace(/\uFEFF/g,""));
      return wanted.includes(clean(ws.name).replace(/\s/g,"").replace(/\uFEFF/g,""));
    }));
    if(!monthTemplate) throw new Error(`ไม่พบชีทแม่แบบสำหรับ ${selectedMonth||"ข้อมูลที่เลือก"}`);

    const monthNum={"มกราคม":1,"กุมภาพันธ์":2,"มีนาคม":3,"เมษายน":4,"พฤษภาคม":5,"มิถุนายน":6,"กรกฎาคม":7,"สิงหาคม":8,"กันยายน":9,"ตุลาคม":10,"พฤศจิกายน":11,"ธันวาคม":12};
    const shortNames={1:"ม.ค.",2:"ก.พ.",3:"มี.ค.",4:"เม.ย.",5:"พ.ค.",6:"มิ.ย.",7:"ก.ค.",8:"ส.ค.",9:"ก.ย.",10:"ต.ค.",11:"พ.ย.",12:"ธ.ค."};
    let targetName="ข้อมูลที่เลือก";
    if(selectedMonth){
      const mn=monthNum[selectedMonth];
      const fy=Number(exportYear||selectedEntries[0]?.year||fiscalYearFromDate(selectedEntries[0]?.date)||0);
      const shortYear=fy ? String(fy-2521-(mn>=10?1:0)).padStart(2,"0") : "";
      targetName=`${shortNames[mn]||selectedMonth}${shortYear}`;
    }

    // ลบชีทเดือนเดิมทั้งหมด แล้วใช้ชีทแม่แบบหนึ่งชีทสร้างใหม่สำหรับข้อมูลที่เลือก
    const monthSheetIds=new Set(wb.worksheets.filter(ws=>monthNames.some(m=>{
      const wanted=monthAliases[m].map(x=>clean(x).replace(/\s/g,"").replace(/\uFEFF/g,""));
      return wanted.includes(clean(ws.name).replace(/\s/g,"").replace(/\uFEFF/g,""));
    })).map(ws=>ws.id));
    const templateId=monthTemplate.id;
    for(const ws of [...wb.worksheets]){
      if(monthSheetIds.has(ws.id) && ws.id!==templateId) wb.removeWorksheet(ws.id);
    }
    monthTemplate.name=targetName;
    const ws=monthTemplate;

    // ไม่ต้องการหัวข้อ "รายงานการรับชำระ..." ในไฟล์ Excel ที่ดาวน์โหลด
    // ซ่อนและล้างแถวที่ 1 (หัวข้อของแม่แบบ) แต่คงแถวหัวตารางเดิมไว้ที่แถว 3
    // เพื่อไม่กระทบตำแหน่งข้อมูล/สูตร/รูปแบบของแม่แบบ
    // ExcelJS 4.x บาง build ไม่มี mergedCells เป็น iterable จึงห้ามใช้ [...ws.mergedCells]
    // ใช้รายการ merge ภายในของ Worksheet แทน และรองรับกรณีไม่มี merge ด้วย
    const mergedRanges = ws && ws._merges ? Object.keys(ws._merges) : [];
    for(const text of mergedRanges){
      const m=String(text).match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
      if(m && Number(m[1])===1 && Number(m[2])===1) ws.unMergeCells(text);
    }
    const titleRow=ws.getRow(1);
    titleRow.eachCell({includeEmpty:true}, cell=>{ cell.value=null; });
    titleRow.hidden=true;
    titleRow.height=0;

    // ไม่สร้างหัวข้อรายงานในไฟล์ที่ดาวน์โหลดตามที่กำหนด

    // ล้างเฉพาะข้อมูลเก่าในชีทใหม่ แต่คงหัวตาราง สี เส้น และความกว้างเดิม
    let totalRow=findTotalRow(ws);
    if(!totalRow) throw new Error(`ไม่พบแถว "รวม" ในชีท ${ws.name}`);
    for(let r=6;r<totalRow;r++) for(let c=1;c<=ws.columnCount;c++) ws.getCell(r,c).value=null;

    const list=selectedEntries.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const capacity=totalRow-6;
    if(list.length>capacity){
      const extra=list.length-capacity;
      ws.insertRows(totalRow,Array.from({length:extra},()=>[]));
      for(let i=0;i<extra;i++) copyDataRowStyle(ws,totalRow+i);
      totalRow+=extra;
    }

    for(let i=0;i<list.length;i++){
      const e=list[i], r=6+i;
      copyDataRowStyle(ws,r);
      if(channelKey==="เคาน์เตอร์เซอร์วิส"){
        set(ws,r,1,eDate(e)); set(ws,r,2,e.law); set(ws,r,3,e.tradeFrom); set(ws,r,4,e.tradeTo); set(ws,r,5,numVal(e.tradeCount)); set(ws,r,6,numVal(e.tradeMoney));
        set(ws,r,7,numVal(e.tradeCancelCount)); set(ws,r,8,e.tradeCancelNo); set(ws,r,9,e.note); set(ws,r,10,e.pn); set(ws,r,11,eSent(e));
      }else if(channelKey==="ไปรษณีย์"){
        set(ws,r,1,eDate(e)); set(ws,r,2,e.law); set(ws,r,3,e.receiptFrom); set(ws,r,4,e.receiptTo); set(ws,r,5,numVal(e.receiptCount)); set(ws,r,6,numVal(e.receiptMoney)); set(ws,r,7,numVal(e.receiptCancelCount)); set(ws,r,8,e.receiptCancelNo);
        set(ws,r,9,e.appBookNo); set(ws,r,10,null); set(ws,r,11,e.appFrom); set(ws,r,12,e.appTo); set(ws,r,13,numVal(e.appCount)); set(ws,r,14,numVal(e.appMoney)); set(ws,r,15,numVal(e.appCancelCount)); set(ws,r,16,e.appCancelNo);
        set(ws,r,17,e.tradeFrom); set(ws,r,18,e.tradeTo); set(ws,r,19,numVal(e.tradeCount)); set(ws,r,20,numVal(e.tradeMoney)); set(ws,r,21,numVal(e.tradeCancelCount)); set(ws,r,22,e.tradeCancelNo);
        formula(ws,r,23,`E${r}+S${r}`); formula(ws,r,24,`F${r}+T${r}`); set(ws,r,25,e.note); set(ws,r,26,e.pn); set(ws,r,27,eSent(e));
      }else{
        set(ws,r,1,eDate(e)); set(ws,r,2,e.law); set(ws,r,3,numVal(e.safetyCount)); set(ws,r,4,numVal(e.safetyMoney)); set(ws,r,5,numVal(e.safetyCancelCount)); set(ws,r,6,e.safetyCancelNo);
        set(ws,r,7,e.receiptFrom); set(ws,r,8,e.receiptTo); set(ws,r,9,numVal(e.receiptCount)); set(ws,r,10,numVal(e.receiptMoney)); set(ws,r,11,numVal(e.receiptCancelCount)); set(ws,r,12,e.receiptCancelNo);
        formula(ws,r,13,`C${r}+I${r}`); formula(ws,r,14,`D${r}+J${r}`); set(ws,r,15,e.tradeFrom); set(ws,r,16,e.tradeTo); set(ws,r,17,numVal(e.tradeCount)); set(ws,r,18,numVal(e.tradeMoney)); set(ws,r,19,numVal(e.tradeCancelCount)); set(ws,r,20,e.tradeCancelNo);
        formula(ws,r,21,`Q${r}`); formula(ws,r,22,`R${r}`); formula(ws,r,23,`M${r}+Q${r}`); formula(ws,r,24,`N${r}+R${r}`); set(ws,r,25,e.note); set(ws,r,26,e.pn);
        if(channelKey==="ศบธ."){set(ws,r,27,e.edc);set(ws,r,28,eSent(e));} else set(ws,r,27,eSent(e));
      }
    }

    const endRow=Math.max(6,totalRow-1);
    if(channelKey==="เคาน์เตอร์เซอร์วิส"){ formula(ws,totalRow,5,`SUM(E6:E${endRow})`); formula(ws,totalRow,6,`SUM(F6:F${endRow})`); }
    else if(channelKey==="ไปรษณีย์"){ for(const c of [5,6,13,14,19,20,21,23,24]) formula(ws,totalRow,c,`SUM(${colLetter(c)}6:${colLetter(c)}${endRow})`); }
    else { for(const c of [3,4,5,9,10,11,13,14,17,18,19,21,22,23,24]) { formula(ws,totalRow,c,`SUM(${colLetter(c)}6:${colLetter(c)}${endRow})`); } }

    // ชีท “ต้นฉบับ” ต้องไม่มีข้อมูลเก่าปะปน และชีท “สรุปยอด” ต้องสร้างใหม่จากข้อมูลที่ดาวน์โหลดจริง
    const original=wb.getWorksheet('ต้นฉบับ');
    if(original){ wb.removeWorksheet(original.id); }

    const summarySheet=wb.getWorksheet('สรุปยอด');
    if(summarySheet){
      // ล้างเฉพาะพื้นที่ข้อมูลเดิม แต่คงหัวตาราง/รูปแบบของแม่แบบไว้
      for(let r=5;r<=summarySheet.rowCount;r++) for(let c=1;c<=9;c++) summarySheet.getCell(r,c).value=null;
      const summaryRowsByMonth={};
      selectedEntries.forEach(e=>{
        const mm=clean(e.month)||monthFromDate(e.date);
        const key=mm;
        if(!summaryRowsByMonth[key]) summaryRowsByMonth[key]={safetyCount:0,safetyMoney:0,receiptCount:0,receiptMoney:0,tradeCount:0,tradeMoney:0,appCount:0,appMoney:0};
        const g=summaryRowsByMonth[key];
        g.safetyCount+=totalSafetyCount(e); g.safetyMoney+=totalSafetyMoney(e);
        g.receiptCount+=totalReceiptCount(e); g.receiptMoney+=totalReceiptMoney(e);
        g.tradeCount+=totalTradeCount(e); g.tradeMoney+=totalTradeMoney(e);
        g.appCount+=totalAppCount(e); g.appMoney+=totalAppMoney(e);
      });
      const ordered=Object.entries(summaryRowsByMonth).sort((a,b)=>MONTHS.indexOf(a[0])-MONTHS.indexOf(b[0]));
      ordered.forEach(([mm,g],idx)=>{
        const r=5+idx;
        const totalCount=g.safetyCount+g.receiptCount+g.appCount+g.tradeCount;
        const totalMoney=g.safetyMoney+g.receiptMoney+g.appMoney+g.tradeMoney;
        summarySheet.getCell(r,1).value=summaryMonthLabel(mm,selectedYear);
        summarySheet.getCell(r,2).value=g.safetyCount; summarySheet.getCell(r,3).value=g.safetyMoney;
        summarySheet.getCell(r,4).value=g.receiptCount+g.appCount; summarySheet.getCell(r,5).value=g.receiptMoney+g.appMoney;
        summarySheet.getCell(r,6).value=g.tradeCount; summarySheet.getCell(r,7).value=g.tradeMoney;
        summarySheet.getCell(r,8).value=totalCount; summarySheet.getCell(r,9).value=totalMoney;
      });
      const summaryTitle=`สรุปการรับชำระค่าธรรมเนียม${cfg.label ? `ผ่าน${cfg.label}` : ''}${selectedMonth ? ` เดือน ${selectedMonth}` : ' รายเดือน/รายปี'}${selectedYear ? ` ${selectedYear}` : ''}`.replace(/\s+/g,' ').trim();
      summarySheet.getCell(1,1).value=summaryTitle;
    }

    applyThaiSarabunFont(wb);
    const out=await wb.xlsx.writeBuffer();
    if(!downloadFile) return out;
    const blob=new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const safe=cfg.label.replace(/[\\/:*?"<>|]/g,"-");
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`ทะเบียนคุม${safe}_${exportYear||"ทุกปี"}_${selectedMonth||"ทุกเดือน"}_เฉพาะข้อมูลที่เลือก.xlsx`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
    return out;
    } finally {
      if(btn){ btn.disabled=false; btn.textContent=oldText||"ดาวน์โหลด Excel"; }
    }
  }

  async function downloadSelectedEntries(monthOnly){
    const y=clean($("entryDownloadYear")?.value), m=clean($("entryDownloadMonth")?.value), l=clean($("entryDownloadLaw")?.value), ch=clean($("entryDownloadChannel")?.value);
    if(monthOnly && !m){alert("กรุณาเลือกเดือนก่อนดาวน์โหลดแบบรายเดือน");return;}
    const channels=ch?[ch]:["ศบธ.","ธนาคาร","ไปรษณีย์","เคาน์เตอร์เซอร์วิส"];
    const valid=[];
    for(const c of channels){const e=selectedEntryDownloadRows(c);if(e.length)valid.push([c,e]);}
    if(!valid.length){alert("ไม่มีข้อมูลตามตัวกรองที่เลือก");return;}
    const btn=$(monthOnly?"downloadEntriesMonth":"downloadEntries"), old=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent=ch?(monthOnly?"กำลังสร้างไฟล์รายเดือน...":"กำลังสร้าง Excel..."):(monthOnly?"กำลังสร้างไฟล์รวมทุกช่องทาง...":"กำลังสร้างไฟล์ทุกช่องทาง...");}
    try{
      if(ch){
        await exportTemplateWorkbook(valid[0][1],valid[0][0],y,m,true);
      }else{
        // ไม่เลือกวิธีการชำระ = ดาวน์โหลดได้ทันที โดยสร้าง ZIP แยก Excel 4 ช่องทาง
        if(!window.JSZip) throw new Error("ระบบ ZIP ยังโหลดไม่เสร็จ กรุณาลองใหม่อีกครั้ง");
        const zip=new JSZip();
        for(const [channel,entries] of valid){
          const out=await exportTemplateWorkbook(entries,channel,y,m,false);
          const safe=channel.replace(/[\/:*?"<>|]/g,"-");
          zip.file(`ทะเบียนคุม${safe}_${y||"ทุกปี"}_${m||"ทุกเดือน"}_${l||"ทุกกฎหมาย"}_เฉพาะข้อมูลที่เลือก.xlsx`,out);
        }
        const zipBlob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
        const a=document.createElement("a"); a.href=URL.createObjectURL(zipBlob); a.download=`ทะเบียนคุม_${y||"ทุกปี"}_${m||"ทุกเดือน"}_${l||"ทุกกฎหมาย"}_ทุกช่องทาง.zip`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
      }
    }catch(err){console.error(err);alert((monthOnly?"ดาวน์โหลด Excel รายเดือนไม่สำเร็จ: ":"ดาวน์โหลด Excel ไม่สำเร็จ: ")+err.message);}
    finally{if(btn){btn.disabled=false;btn.textContent=old||"ดาวน์โหลด Excel";}}
  }
  $("downloadEntriesMonth")?.addEventListener("click",()=>downloadSelectedEntries(true));
  $("downloadSummary")?.addEventListener("click",async ()=>{
    const e=summaryRows(); if(!e.length){alert("ยังไม่มีข้อมูลสำหรับสรุป");return;}
    const sy=clean($("summaryYear")?.value)||"ทุกปี", sm=clean($("summaryMonth")?.value)||"ทุกเดือน";
    const title=`สรุปการรับชำระค่าธรรมเนียม ${sy==="ทุกปี"?"":`ปีงบประมาณ ${sy}`} ${sm!=="ทุกเดือน"?`เดือน ${sm}`:"รายเดือน/รายปี"}`.replace(/\s+/g," ").trim();
    await exportSummaryExcelGrid(e,`สรุปค่าธรรมเนียม_${sy}_${sm}.xlsx`,title,`ตัวกรอง: ปี ${sy} | เดือน ${sm}`,sy,sm);
  });
  document.querySelectorAll("[data-entry-channel]").forEach(btn=>btn.addEventListener("click",()=>{
    activeEntryChannel=btn.dataset.entryChannel||"ศบธ.";
    document.querySelectorAll("[data-entry-channel]").forEach(b=>b.classList.toggle("active",b===btn));
    updateEntryFormForChannel();
    refreshEntryDownloadFilters();
    renderEntryTable();
  }));
  initThaiDatePickers(); resetEntryForm();refreshEntryDownloadFilters();renderEntryTable();renderSummary();
}

// Cache imported rows so adding/deleting daily entries never loses the original Excel data.
const _oldLoadDefault = loadDefault;
loadDefault = async function(){
  const response=await fetch("data/update.xlsx?v=20260922-1",{cache:"no-store"});
  if(!response.ok)throw new Error("โหลด data/update.xlsx ไม่สำเร็จ");
  const buffer=await response.arrayBuffer();const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  excelCacheRows=excelToRows(wb);setData(excelCacheRows,"update.xlsx");
};

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",initAppNavigation); else initAppNavigation();

(async()=>{
  await initCloudStorage();
  await loadDefault();
  // ข้อมูลจาก Cloud/Excel โหลดเสร็จแล้ว ต้องเติมตัวกรองปี/เดือนอีกครั้ง
  // เพื่อไม่ให้ dropdown ว่างเพราะตอนเริ่มหน้าเว็บข้อมูลยังโหลดไม่เสร็จ
  refreshEntryDownloadFilters();
  renderEntryTable();
  renderSummary();
})().catch(err=>{console.error(err);alert("โหลดข้อมูลไม่ได้: "+err.message);});
