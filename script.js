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
const MANUAL_KEY = "fee_dashboard_daily_report_v5";
let cloudEntries = [];
let cloudReady = false;
const hasCloudConfig = () => !!(window.FEE_SUPABASE_URL && window.FEE_SUPABASE_PUBLISHABLE_KEY && !String(window.FEE_SUPABASE_URL).includes("ใส่_"));
const cloudClient = hasCloudConfig() && window.supabase ? window.supabase.createClient(window.FEE_SUPABASE_URL, window.FEE_SUPABASE_PUBLISHABLE_KEY) : null;
function getManualEntries(){ return cloudReady ? cloudEntries : JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]"); }
function saveManualEntries(entries){ cloudEntries = entries; if(!cloudReady) localStorage.setItem(MANUAL_KEY, JSON.stringify(entries)); }
async function initCloudStorage(){
  if(!cloudClient){ cloudReady=false; return; }
  try{
    const {data,error}=await cloudClient.from("daily_entries").select("id,payload").order("created_at",{ascending:true});
    if(error) throw error;
    cloudEntries=(data||[]).map(r=>({...r.payload,id:r.id}));
    cloudReady=true;
    const old=JSON.parse(localStorage.getItem(MANUAL_KEY)||"[]");
    if(cloudEntries.length===0 && old.length){
      for(const entry of old){ await cloudClient.from("daily_entries").upsert({id:entry.id,user_id:null,payload:entry}); }
      const {data:again}=await cloudClient.from("daily_entries").select("id,payload").order("created_at",{ascending:true});
      cloudEntries=(again||[]).map(r=>({...r.payload,id:r.id}));
    }
    localStorage.removeItem(MANUAL_KEY);
  }catch(e){ console.error(e); cloudReady=false; cloudEntries=JSON.parse(localStorage.getItem(MANUAL_KEY)||"[]"); alert("เชื่อมต่อ Cloud ไม่สำเร็จ ระบบจะเก็บข้อมูลไว้ในเครื่องนี้ชั่วคราว\n\n"+e.message); }
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
function totalTradeCount(e){ return num(e.tradeCount); }
function totalTradeMoney(e){ return num(e.tradeMoney); }
function totalGovCount(e){ return num(e.govCount); }
function totalGovMoney(e){ return num(e.govMoney); }
function reportTotalCount(e){ return totalReceiptCount(e)+totalTradeCount(e); }
function reportTotalMoney(e){ return totalReceiptMoney(e)+totalTradeMoney(e); }

function manualEntriesToRows(entries){
  return entries.map(e=>({
    [Y]:clean(e.year), [M]:clean(e.month)||monthFromDate(e.date), [L]:clean(e.law),
    "วันที่ชำระ":clean(e.date),
    "Manual_Safety_Count":totalSafetyCount(e), "Manual_Safety_Money":totalSafetyMoney(e),
    "Manual_Safety_Cancel_Count":totalSafetyCancelCount(e),
    "Receipt_จาก":clean(e.receiptFrom), "Receipt_ถึง":clean(e.receiptTo),
    "Manual_Receipt_Count":totalReceiptCount(e), "Manual_Receipt_Money":totalReceiptMoney(e),
    "Manual_Receipt_Cancel_Count":num(e.receiptCancelCount), "Manual_Receipt_Cancel_No":clean(e.receiptCancelNo),
    "Trade_จาก":clean(e.tradeFrom), "Trade_ถึง":clean(e.tradeTo),
    "Manual_Trade_Count":totalTradeCount(e), "Manual_Trade_Money":totalTradeMoney(e),
    "Manual_Trade_Cancel_Count":num(e.tradeCancelCount), "Manual_Trade_Cancel_No":clean(e.tradeCancelNo),
    "Manual_Gov_Count":totalGovCount(e), "Manual_Gov_Money":totalGovMoney(e),
    "หมายเหตุ":clean(e.note), "พน0401.1/":clean(e.pn), "วันที่ส่ง":clean(e.sent),
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
function resetEntryForm(){
  ["entryYear","entryLaw","safetyCount","safetyMoney","safetyCancelCount","receiptFrom","receiptTo","receiptCount","receiptMoney","receiptCancelCount","receiptCancelNo","tradeFrom","tradeTo","tradeCount","tradeMoney","tradeCancelCount","tradeCancelNo","govCount","govMoney","entryNote","entryPn"].forEach(id=>{if($(id)) $(id).value="";});
  clearThaiDatePicker("entryDate"); clearThaiDatePicker("entrySent");
}

async function addDailyEntry(){
  const dateInput=clean($("entryDate").value), sentInput=clean($("entrySent").value);
  const date=parseUserDate(dateInput), sent=sentInput?parseUserDate(sentInput):"";
  const sc=num($("safetyCount").value), sm=num($("safetyMoney").value), scc=num($("safetyCancelCount").value);
  const rc=num($("receiptCount").value), rm=num($("receiptMoney").value), tc=num($("tradeCount").value), tm=num($("tradeMoney").value), gc=num($("govCount").value), gm=num($("govMoney").value);
  const hasAny=[sc,sm,scc,rc,rm,tc,tm,gc,gm,num($("receiptCancelCount").value),num($("tradeCancelCount").value)].some(v=>v!==0);
  if(!date){alert("กรุณาเขียนวันที่ชำระ เช่น 17 ก.ย. 2569");return;}
  if(sentInput&&!sent){alert("กรุณาเขียนวันที่ส่ง เช่น 17 ก.ย. 2569");return;}
  if(!hasAny){alert("กรุณากรอกข้อมูลอย่างน้อย 1 รายการ");return;}
  const entry={id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),date,year:clean($("entryYear").value)||fiscalYearFromDate(date),month:monthFromDate(date),law:clean($("entryLaw").value),sent,safetyCount:sc,safetyMoney:sm,safetyCancelCount:scc,receiptFrom:clean($("receiptFrom").value),receiptTo:clean($("receiptTo").value),receiptCount:rc,receiptMoney:rm,receiptCancelCount:num($("receiptCancelCount").value),receiptCancelNo:clean($("receiptCancelNo").value),tradeFrom:clean($("tradeFrom").value),tradeTo:clean($("tradeTo").value),tradeCount:tc,tradeMoney:tm,tradeCancelCount:num($("tradeCancelCount").value),tradeCancelNo:clean($("tradeCancelNo").value),govCount:gc,govMoney:gm,note:clean($("entryNote").value),pn:clean($("entryPn").value)};
  try{
    if(cloudReady) await cloudInsertEntry(entry);
    const entries=getManualEntries().concat(entry); saveManualEntries(entries); setData(excelCacheRows,"update.xlsx"); resetEntryForm();
    alert(cloudReady?"บันทึกข้อมูลลง Cloud เรียบร้อยแล้ว":"บันทึกข้อมูลไว้ในเครื่องนี้แล้ว");
  }catch(e){alert("บันทึกข้อมูลไม่สำเร็จ: "+e.message);}
}

function renderEntryTable(){
  const el=$("entryTable"); if(!el)return;
  const entries=getManualEntries().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const head=["วันที่ชำระ","Safety ใบเสร็จ","Safety บาท","Safety ยกเลิก","Receipt ใบเสร็จ","Receipt บาท","Receipt ยกเลิก","Trade ใบเสร็จ","Trade บาท","Trade ยกเลิก","นำรายได้ ใบเสร็จ","นำรายได้ บาท","พน0401.1/","วันที่ส่ง","จัดการ"];
  let html="<thead><tr>"+head.map(h=>`<th>${esc(h)}</th>`).join("")+"</tr></thead><tbody>";
  if(!entries.length) html+='<tr><td colspan="15" class="empty-cell">ยังไม่มีข้อมูลที่ป้อนเอง</td></tr>';
  else entries.forEach((e,i)=>{
    html+=`<tr><td>${esc(displayDate(e.date))}</td><td class="num-cell">${fmt(totalSafetyCount(e))}</td><td class="num-cell">${num(e.safetyMoney).toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td class="num-cell">${fmt(e.safetyCancelCount)}</td><td class="num-cell">${fmt(totalReceiptCount(e))}</td><td class="num-cell">${num(e.receiptMoney).toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td class="num-cell">${fmt(e.receiptCancelCount)}</td><td class="num-cell">${fmt(totalTradeCount(e))}</td><td class="num-cell">${num(e.tradeMoney).toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td class="num-cell">${fmt(e.tradeCancelCount)}</td><td class="num-cell">${fmt(totalGovCount(e))}</td><td class="num-cell">${num(e.govMoney).toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${esc(e.pn)}</td><td>${esc(displayDate(e.sent))}</td><td><button class="delete-entry" data-index="${i}">ลบ</button></td></tr>`;
  });
  html+="</tbody>"; el.innerHTML=html;
  el.querySelectorAll(".delete-entry").forEach(btn=>btn.addEventListener("click",async ()=>{
    const entries=getManualEntries().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const target=entries[Number(btn.dataset.index)], all=getManualEntries(), idx=all.findIndex(x=>x.id===target.id);
    if(idx>=0 && confirm(`ต้องการลบข้อมูลวันที่ ${displayDate(target.date)} ใช่หรือไม่?`)){try{if(cloudReady) await cloudDeleteEntry(target.id);all.splice(idx,1);saveManualEntries(all);setData(excelCacheRows,"update.xlsx");}catch(e){alert("ลบข้อมูลไม่สำเร็จ: "+e.message);}}
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
  filteredEntries.forEach(e=>{const key=`${e.year}|${e.month}`;if(!groups[key])groups[key]={year:e.year,month:e.month,days:new Set(),safetyCount:0,safetyMoney:0,receiptCount:0,receiptMoney:0,tradeCount:0,tradeMoney:0,govCount:0,govMoney:0};groups[key].days.add(e.date);groups[key].receiptCount+=totalReceiptCount(e);groups[key].receiptMoney+=totalReceiptMoney(e);groups[key].tradeCount+=totalTradeCount(e);groups[key].tradeMoney+=totalTradeMoney(e);groups[key].govCount+=totalGovCount(e);groups[key].govMoney+=totalGovMoney(e);});
  const arr=Object.values(groups).sort((a,b)=>String(a.year).localeCompare(String(b.year))||MONTHS.indexOf(a.month)-MONTHS.indexOf(b.month));
  let html='<thead><tr><th>ปีงบประมาณ</th><th>เดือน</th><th>จำนวนวันที่มีข้อมูล</th><th>Safety ใบเสร็จ</th><th>Safety บาท</th><th>Receipt ใบเสร็จ</th><th>Receipt บาท</th><th>Trade ใบเสร็จ</th><th>Trade บาท</th><th>นำรายได้ ใบเสร็จ</th><th>นำรายได้ บาท</th><th>รวมใบเสร็จ</th><th>รวมเงิน</th></tr></thead><tbody>';
  if(!arr.length)html+='<tr><td colspan="13" class="empty-cell">ยังไม่มีข้อมูลตามตัวกรอง</td></tr>';
  arr.forEach(g=>{const totalC=g.receiptCount+g.tradeCount,totalM=g.receiptMoney+g.tradeMoney;html+=`<tr><td>${esc(g.year)}</td><td>${esc(g.month)}</td><td>${g.days.size.toLocaleString("th-TH")}</td><td>${g.safetyCount.toLocaleString("th-TH")}</td><td>${g.safetyMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.receiptCount.toLocaleString("th-TH")}</td><td>${g.receiptMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.tradeCount.toLocaleString("th-TH")}</td><td>${g.tradeMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td>${g.govCount.toLocaleString("th-TH")}</td><td>${g.govMoney.toLocaleString("th-TH",{minimumFractionDigits:2})}</td><td><b>${totalC.toLocaleString("th-TH")}</b></td><td><b>${totalM.toLocaleString("th-TH",{minimumFractionDigits:2})}</b></td></tr>`;});
  html+='</tbody>'; $("summaryTable").innerHTML=html;
}

function downloadText(content,name,type){const blob=new Blob([content],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function downloadChart(chartId){const c=charts[chartId];if(!c){alert("กราฟนี้ยังไม่พร้อมดาวน์โหลด");return;}const url=c.toBase64Image("image/png",1);const a=document.createElement("a");a.href=url;a.download=`กราฟ_${chartId}_${new Date().toISOString().slice(0,10)}.png`;document.body.appendChild(a);a.click();a.remove();}

function reportCell(v, cls=""){ return `<td class="${cls}">${esc(v)}</td>`; }
function reportNum(v){ return Number(v||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function exportDailyReportExcel(entries,fileName,title){
  const body=entries.map(e=>`<tr>
    ${reportCell(displayDate(e.date),"date")}
    ${reportCell(e.safetyCount,"num-int")}${reportCell(reportNum(e.safetyMoney),"num")}${reportCell(e.safetyCancelCount,"num-int")}
    ${reportCell(e.receiptFrom)}${reportCell(e.receiptTo)}${reportCell(e.receiptCount,"num-int")}${reportCell(reportNum(e.receiptMoney),"num")}${reportCell(e.receiptCancelCount,"num-int")}${reportCell(e.receiptCancelNo)}
    ${reportCell(e.tradeFrom)}${reportCell(e.tradeTo)}${reportCell(e.tradeCount,"num-int")}${reportCell(reportNum(e.tradeMoney),"num")}${reportCell(e.tradeCancelCount,"num-int")}${reportCell(e.tradeCancelNo)}
    ${reportCell(e.govCount,"num-int")}${reportCell(reportNum(e.govMoney),"num")}
    ${reportCell(e.note)}${reportCell(e.pn)}${reportCell(displayDate(e.sent),"date")}
  </tr>`).join("");
  const totals=entries.reduce((a,e)=>{a.sc+=totalSafetyCount(e);a.sm+=totalSafetyMoney(e);a.scc+=totalSafetyCancelCount(e);a.rc+=totalReceiptCount(e);a.rm+=totalReceiptMoney(e);a.rcc+=num(e.receiptCancelCount);a.tc+=totalTradeCount(e);a.tm+=totalTradeMoney(e);a.tcc+=num(e.tradeCancelCount);a.gc+=totalGovCount(e);a.gm+=totalGovMoney(e);a.totalc+=reportTotalCount(e);a.totalm+=reportTotalMoney(e);return a;},{sc:0,sm:0,scc:0,rc:0,rm:0,rcc:0,tc:0,tm:0,tcc:0,gc:0,gm:0,totalc:0,totalm:0});
  const totalRow=`<tr class="total-row"><td class="center"><b>รวม</b></td><td class="num-int"><b>${totals.sc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.sm)}</b></td><td class="num-int"><b>${totals.scc.toLocaleString("th-TH")}</b></td><td></td><td></td><td class="num-int"><b>${totals.rc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.rm)}</b></td><td class="num-int"><b>${totals.rcc.toLocaleString("th-TH")}</b></td><td></td><td></td><td class="num-int"><b>${totals.tc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.tm)}</b></td><td class="num-int"><b>${totals.tcc.toLocaleString("th-TH")}</b></td><td></td><td class="num-int"><b>${totals.gc.toLocaleString("th-TH")}</b></td><td class="num"><b>${reportNum(totals.gm)}</b></td><td></td><td></td><td></td></tr>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt;color:#17283b}table,th,td{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt}h1{text-align:center;font-size:16pt;margin:0 0 12px}.meta{text-align:center;margin-bottom:12px;color:#555}
  table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #333;padding:6px 5px;vertical-align:middle;word-wrap:break-word}th{text-align:center;font-weight:bold} .blue{background:#a9ddec}.safety{background:#f4df8c}.receipt{background:#f3b36e}.trade{background:#f3aab8}.gov{background:#d9e8a5}.purple{background:#b7a9d8}.plainblue{background:#9ecbe4}
  .center{text-align:center}.num,.num-int{text-align:right}.num{mso-number-format:"#,##0.00"}.num-int{mso-number-format:"#,##0"}.date{text-align:center}.total-row td{font-weight:bold;background:#f4f6f8}
  col.date{width:85px}col.narrow{width:72px}col.money{width:90px}col.note{width:120px}col.pn{width:75px}col.sent{width:85px}
  </style></head><body>
  <h1>${esc(title)}</h1><div class="meta">ข้อมูลที่ป้อนจากระบบ Dashboard • ${entries.length.toLocaleString("th-TH")} รายการ</div>
  <table><colgroup><col class="date"><col class="narrow"><col class="money"><col class="narrow"><col><col><col class="narrow"><col class="money"><col class="narrow"><col><col><col><col class="narrow"><col class="money"><col class="narrow"><col><col class="narrow"><col class="money"><col class="note"><col class="pn"><col class="sent"></colgroup>
  <thead><tr><th rowspan="2" class="blue">วันที่ชำระ</th><th colspan="3" class="safety">ระบบ Safety</th><th colspan="6" class="receipt">ระบบ Receipt (ใบเสร็จรับเงิน A4)</th><th colspan="6" class="trade">ระบบ Trade</th><th colspan="2" class="gov">นำรายได้ ส่ง กค.<br>พรบ.42 + พรบ.43</th><th rowspan="2" class="purple">หมายเหตุ</th><th rowspan="2" class="plainblue">พน0401.1/</th><th rowspan="2" class="plainblue">วันที่ส่ง</th></tr>
  <tr><th class="safety">จำนวนใบเสร็จ</th><th class="safety">จำนวนเงิน</th><th class="safety">ยกเลิกใบเสร็จ<br>จำนวนใบเสร็จที่ยกเลิก</th><th class="receipt">จาก</th><th class="receipt">ถึง</th><th class="receipt">จำนวนใบเสร็จ</th><th class="receipt">จำนวนเงิน</th><th class="receipt">ยกเลิก/และสูญเสีย<br>จำนวนใบเสร็จ</th><th class="receipt">เลขที่ใบเสร็จ</th><th class="trade">จาก</th><th class="trade">ถึง</th><th class="trade">จำนวนใบเสร็จ</th><th class="trade">จำนวนเงิน</th><th class="trade">ยกเลิก/และสูญเสีย<br>จำนวนใบเสร็จ</th><th class="trade">เลขที่ใบเสร็จ</th><th class="gov">จำนวนใบเสร็จ</th><th class="gov">จำนวนเงิน</th></tr></thead>
  <tbody>${body}${totalRow}</tbody></table></body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fileName;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}

function initAppNavigation(){
  const links=[...document.querySelectorAll(".side-link")],views=[...document.querySelectorAll(".app-view")];
  function show(id){links.forEach(b=>b.classList.toggle("active",b.dataset.view===id));views.forEach(v=>v.classList.toggle("active-view",v.id===id));if(id==="entryView")renderEntryTable();if(id==="summaryView")renderSummary();window.scrollTo({top:0,behavior:"smooth"});}
  links.forEach(b=>b.addEventListener("click",()=>{show(b.dataset.view);$("sidebar")?.classList.remove("open");}));
  $("mobileMenu")?.addEventListener("click",()=>$("sidebar")?.classList.toggle("open"));
  document.querySelectorAll(".chart-download").forEach(b=>b.addEventListener("click",()=>downloadChart(b.dataset.chart)));
  $("saveEntry")?.addEventListener("click",addDailyEntry); $("clearEntry")?.addEventListener("click",resetEntryForm);
  $("summaryYear")?.addEventListener("change",renderSummary); $("summaryMonth")?.addEventListener("change",renderSummary);
  $("downloadEntries")?.addEventListener("click",()=>{
    const e=getManualEntries().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(!e.length){alert("ยังไม่มีข้อมูลที่ป้อนเอง");return;}
    const years=[...new Set(e.map(x=>x.year).filter(Boolean))],months=[...new Set(e.map(x=>x.month).filter(Boolean))];
    const title=years.length===1?(months.length===1?`รายงานการรับชำระค่าธรรมเนียมผ่านไปรษณีย์ เดือน ${months[0]} ${years[0]}`:`รายงานการรับชำระค่าธรรมเนียมผ่านไปรษณีย์ ปีงบประมาณ ${years[0]}`):"รายงานการรับชำระค่าธรรมเนียมผ่านไปรษณีย์";
    exportDailyReportExcel(e,`รายงานค่าธรรมเนียม_รายวัน_${new Date().toISOString().slice(0,10)}.xls`,title);
  });
  // ดาวน์โหลดสรุปเดือน/ปีเป็น Excel-compatible .xls แบบตารางอ่านง่าย
  function exportSummaryExcelGrid(entries, fileName, title, filterText){
    const groups={};
    entries.forEach(x=>{
      const key=`${x.year}|${x.month}`;
      if(!groups[key]) groups[key]={year:x.year,month:x.month,days:new Set(),safetyCount:0,safetyMoney:0,receiptCount:0,receiptMoney:0,tradeCount:0,tradeMoney:0,govCount:0,govMoney:0};
      const g=groups[key];
      if(x.date) g.days.add(x.date);
      g.safetyCount+=totalSafetyCount(x); g.safetyMoney+=totalSafetyMoney(x);
      g.receiptCount+=totalReceiptCount(x); g.receiptMoney+=totalReceiptMoney(x);
      g.tradeCount+=totalTradeCount(x); g.tradeMoney+=totalTradeMoney(x);
      g.govCount+=totalGovCount(x); g.govMoney+=totalGovMoney(x);
    });
    const arr=Object.values(groups).sort((a,b)=>String(a.year).localeCompare(String(b.year))||MONTHS.indexOf(a.month)-MONTHS.indexOf(b.month));
    const fmt=n=>Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtInt=n=>Number(n||0).toLocaleString("th-TH");
    let body="";
    let totals={days:new Set(),sc:0,sm:0,rc:0,rm:0,tc:0,tm:0,gc:0,gm:0};
    arr.forEach(g=>{
      const totalC=g.receiptCount+g.tradeCount, totalM=g.receiptMoney+g.tradeMoney;
      g.days.forEach(d=>totals.days.add(d)); totals.sc+=g.safetyCount; totals.sm+=g.safetyMoney; totals.rc+=g.receiptCount; totals.rm+=g.receiptMoney; totals.tc+=g.tradeCount; totals.tm+=g.tradeMoney; totals.gc+=g.govCount; totals.gm+=g.govMoney;
      body+=`<tr><td>${excelCell(g.year)}</td><td>${excelCell(g.month)}</td><td class="num-int">${fmtInt(g.days.size)}</td><td class="num-int">${fmtInt(g.safetyCount)}</td><td class="num">${fmt(g.safetyMoney)}</td><td class="num-int">${fmtInt(g.receiptCount)}</td><td class="num">${fmt(g.receiptMoney)}</td><td class="num-int">${fmtInt(g.tradeCount)}</td><td class="num">${fmt(g.tradeMoney)}</td><td class="num-int">${fmtInt(g.govCount)}</td><td class="num">${fmt(g.govMoney)}</td><td class="num-int"><b>${fmtInt(totalC)}</b></td><td class="num"><b>${fmt(totalM)}</b></td></tr>`;
    });
    const totalC=totals.rc+totals.tc,totalM=totals.rm+totals.tm;
    body+=`<tr class="total"><td colspan="2"><b>รวมทั้งหมด</b></td><td class="num-int"><b>${fmtInt(totals.days.size)}</b></td><td class="num-int"><b>${fmtInt(totals.sc)}</b></td><td class="num"><b>${fmt(totals.sm)}</b></td><td class="num-int"><b>${fmtInt(totals.rc)}</b></td><td class="num"><b>${fmt(totals.rm)}</b></td><td class="num-int"><b>${fmtInt(totals.tc)}</b></td><td class="num"><b>${fmt(totals.tm)}</b></td><td class="num-int"><b>${fmtInt(totals.gc)}</b></td><td class="num"><b>${fmt(totals.gm)}</b></td><td class="num-int"><b>${fmtInt(totalC)}</b></td><td class="num"><b>${fmt(totalM)}</b></td></tr>`;
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt;color:#17283b}table,th,td{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,Arial,sans-serif;font-size:16pt} h1{text-align:center;font-size:18pt;margin:0 0 6px} .meta{text-align:center;color:#555;margin:0 0 14px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #333;padding:8px 9px;vertical-align:middle} th{text-align:center;font-weight:bold;background:#e7f1f8} .receipt{background:#f6c27b}.trade{background:#f3b5c1}.gov{background:#d7e9b1}.total td{background:#e8eef3;font-weight:bold}.num,.num-int{text-align:right}.num{mso-number-format:"#,##0.00"}.num-int{mso-number-format:"#,##0"}.center{text-align:center}</style></head><body>
      <h1>${excelCell(title)}</h1><div class="meta">${excelCell(filterText)}</div>
      <table><thead><tr><th rowspan="2">ปีงบประมาณ</th><th rowspan="2">เดือน</th><th rowspan="2">จำนวนวันที่มีข้อมูล</th><th colspan="2" class="safety">ระบบ Safety</th><th colspan="2" class="receipt">ระบบ Receipt</th><th colspan="2" class="trade">ระบบ Trade</th><th colspan="2" class="gov">นำรายได้ส่ง กค.</th><th colspan="2">รวม</th></tr>
      <tr><th class="safety">จำนวนใบเสร็จ</th><th class="safety">จำนวนเงิน (บาท)</th><th class="receipt">จำนวนใบเสร็จ</th><th class="receipt">จำนวนเงิน (บาท)</th><th class="trade">จำนวนใบเสร็จ</th><th class="trade">จำนวนเงิน (บาท)</th><th class="gov">จำนวนใบเสร็จ</th><th class="gov">จำนวนเงิน (บาท)</th><th>จำนวนใบเสร็จ</th><th>จำนวนเงิน (บาท)</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fileName; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
  }

  $("downloadSummary")?.addEventListener("click",()=>{
    const e=summaryRows(); if(!e.length){alert("ยังไม่มีข้อมูลสำหรับสรุป");return;}
    const sy=clean($("summaryYear")?.value)||"ทุกปี", sm=clean($("summaryMonth")?.value)||"ทุกเดือน";
    const title=`สรุปการรับชำระค่าธรรมเนียม ${sy==="ทุกปี"?"":`ปีงบประมาณ ${sy}`} ${sm!=="ทุกเดือน"?`เดือน ${sm}`:"รายเดือน/รายปี"}`.replace(/\s+/g," ").trim();
    exportSummaryExcelGrid(e,`สรุปค่าธรรมเนียม_${sy}_${sm}.xls`,title,`ตัวกรอง: ปี ${sy} | เดือน ${sm}`);
  });
  initThaiDatePickers(); resetEntryForm();renderEntryTable();renderSummary();
}

// Cache imported rows so adding/deleting daily entries never loses the original Excel data.
const _oldLoadDefault = loadDefault;
loadDefault = async function(){
  const response=await fetch("data/update.xlsx?v=20260917-3",{cache:"no-store"});
  if(!response.ok)throw new Error("โหลด data/update.xlsx ไม่สำเร็จ");
  const buffer=await response.arrayBuffer();const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  excelCacheRows=excelToRows(wb);setData(excelCacheRows,"update.xlsx");
};

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",initAppNavigation); else initAppNavigation();

(async()=>{ await initCloudStorage(); await loadDefault(); })().catch(err=>{console.error(err);alert("โหลดข้อมูลไม่ได้: "+err.message);});
