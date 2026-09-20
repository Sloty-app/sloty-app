import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { C } from "../constants";

/* Dashboard charts for the admin Overview: stores registered per month,
   bookings per day, and the approval-status split. Data comes from
   GET /bookings/admin/stats (storesByMonth, bookingsByDay, storeStatus). */

const card = { background:"rgba(255,255,255,0.04)", borderRadius:20, padding:16, border:"1px solid rgba(255,255,255,0.06)" };
const title = { fontSize:14, fontWeight:900, color:"#fff", marginBottom:12 };
const tick = { fill:"rgba(255,255,255,0.45)", fontSize:11 };
const tip = { contentStyle:{ background:"#1A1A2E", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, color:"#fff", fontSize:12 }, cursor:{ fill:"rgba(255,255,255,0.05)" } };

function BarCard({ heading, data, color }) {
  const empty = !data.some(d => d.count > 0);
  return (
    <div style={card}>
      <h3 style={title}>{heading}</h3>
      <div style={{ height:210, position:"relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top:6, right:6, left:-22, bottom:0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
            <Tooltip {...tip} formatter={v => [v, "Count"]} />
            <Bar dataKey="count" fill={color} radius={[6,6,0,0]} maxBarSize={38} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        {empty && <p style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"rgba(255,255,255,0.35)", pointerEvents:"none" }}>Nothing recorded in this period</p>}
      </div>
    </div>
  );
}

function StatusCard({ status }) {
  const rows = [
    { name:"Approved", value:status.approved, color:C.green },
    { name:"Pending",  value:status.pending,  color:C.acc },
    { name:"Removed",  value:status.removed,  color:C.red },
  ];
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <div style={card}>
      <h3 style={title}>Store status</h3>
      <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap", justifyContent:"center" }}>
        <div style={{ width:170, height:170, position:"relative", flexShrink:0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={total ? rows : [{ name:"None", value:1, color:"rgba(255,255,255,0.1)" }]} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={total ? 3 : 0} stroke="none" isAnimationActive={false}>
                {(total ? rows : [{ color:"rgba(255,255,255,0.1)" }]).map((r, i) => <Cell key={i} fill={r.color} />)}
              </Pie>
              {total > 0 && <Tooltip {...tip} />}
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:24, fontWeight:900, color:"#fff", lineHeight:1 }}>{total}</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>stores</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {rows.map(r => (
            <div key={r.name} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.7)" }}>
              <span style={{ width:10, height:10, borderRadius:"50%", background:r.color }} />
              {r.name}
              <b style={{ color:"#fff", marginLeft:4 }}>{total ? Math.round(r.value / total * 100) : 0}%</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminCharts({ stats }) {
  if (!stats?.storesByMonth) return null;
  return (
    <div className="chart-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:14, marginBottom:20 }}>
      <BarCard heading="Store registrations · last 6 months" data={stats.storesByMonth} color={C.green} />
      <BarCard heading="Bookings · last 7 days" data={stats.bookingsByDay} color={C.pri} />
      <StatusCard status={stats.storeStatus} />
    </div>
  );
}
