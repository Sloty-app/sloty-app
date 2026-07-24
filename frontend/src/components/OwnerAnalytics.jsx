import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Users, Clock, Award, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { C } from "../constants";
import { Card, Loader } from "./UI";

// SectionHeader isn't part of the shared UI library — it's defined
// locally wherever it's used (matches the same pattern OwnerApp.jsx
// itself uses).
const SectionHeader = ({ icon: Icon, title, color=C.pri }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
    <div style={{ width:32, height:32, borderRadius:10, background:color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon size={16} color={color} />
    </div>
    <h3 style={{ fontSize:14, fontWeight:900, color:C.text, margin:0 }}>{title}</h3>
  </div>
);

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
};
const formatHour = (h) => {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
};

export default function OwnerAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [range, setRange] = useState(30);

  const fetchAnalytics = async (days) => {
    setLoading(true); setErr("");
    try {
      const res = await api("GET", `/analytics/dashboard?days=${days}`);
      setData(res);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(range); }, [range]);

  if (loading && !data) return <div style={{ padding:20 }}><Loader skeleton /></div>;
  if (err) return <div style={{ padding:20 }}><Card><p style={{ color:C.red, fontSize:13, textAlign:"center" }}>{err}</p></Card></div>;
  if (!data) return null;

  const totalRevenue = data.revenueTrend.reduce((s,d) => s + d.revenue, 0);
  const avgNoShowRate = data.noShowTrend.length
    ? Math.round(data.noShowTrend.reduce((s,d) => s + d.rate, 0) / data.noShowTrend.length)
    : 0;
  const totalCustomers = data.customers.new + data.customers.returning;
  const returningPct = totalCustomers > 0 ? Math.round((data.customers.returning / totalCustomers) * 100) : 0;
  const busiestHour = data.peakHours.length ? data.peakHours.reduce((a,b) => a.count > b.count ? a : b) : null;

  const PIE_COLORS = [C.pri, "#E8ECF5"];

  return (
    <div style={{ padding:20 }}>
      {/* Range selector */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setRange(d)} style={{ flex:1, padding:"8px", borderRadius:10, border:`1.5px solid ${range===d?C.pri:"#E8ECF5"}`, background:range===d?C.pri+"12":"#fff", color:range===d?C.pri:C.muted, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
            Last {d} days
          </button>
        ))}
      </div>

      {/* Quick summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:14, borderLeft:`3px solid ${C.pri}` }}>
          <p style={{ fontSize:10, color:C.muted, fontWeight:700 }}>TOTAL REVENUE</p>
          <p style={{ fontSize:18, fontWeight:900, color:C.text }}>₹{totalRevenue}</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:14, borderLeft:`3px solid ${C.green}` }}>
          <p style={{ fontSize:10, color:C.muted, fontWeight:700 }}>RETURNING CUSTOMERS</p>
          <p style={{ fontSize:18, fontWeight:900, color:C.text }}>{returningPct}%</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:14, borderLeft:`3px solid ${C.acc}` }}>
          <p style={{ fontSize:10, color:C.muted, fontWeight:700 }}>BUSIEST HOUR</p>
          <p style={{ fontSize:18, fontWeight:900, color:C.text }}>{busiestHour ? formatHour(busiestHour.hour) : "—"}</p>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:14, borderLeft:`3px solid ${C.red}` }}>
          <p style={{ fontSize:10, color:C.muted, fontWeight:700 }}>AVG NO-SHOW RATE</p>
          <p style={{ fontSize:18, fontWeight:900, color:C.text }}>{avgNoShowRate}%</p>
        </div>
      </div>

      {/* Revenue trend */}
      <Card>
        <SectionHeader icon={TrendingUp} title="Revenue Trend" />
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize:10 }} interval={Math.floor(data.revenueTrend.length/5)} />
            <YAxis tick={{ fontSize:10 }} />
            <Tooltip labelFormatter={formatDateShort} formatter={(v) => [`₹${v}`, "Revenue"]} />
            <Line type="monotone" dataKey="revenue" stroke={C.pri} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Revenue by service */}
      <Card>
        <SectionHeader icon={Award} title="Top Services by Revenue" />
        {data.revenueByService.length === 0 ? (
          <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"16px 0" }}>No completed bookings yet in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, data.revenueByService.length * 34)}>
            <BarChart data={data.revenueByService} layout="vertical" margin={{ left:10 }}>
              <XAxis type="number" tick={{ fontSize:10 }} />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize:11 }} />
              <Tooltip formatter={(v) => [`₹${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill={C.pri} radius={[0,6,6,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* New vs returning customers */}
      <Card>
        <SectionHeader icon={Users} title="New vs Returning Customers" />
        {totalCustomers === 0 ? (
          <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"16px 0" }}>No customers in this period yet.</p>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={[{ name:"Returning", value:data.customers.returning }, { name:"New", value:data.customers.new }]} dataKey="value" innerRadius={35} outerRadius={60}>
                  {PIE_COLORS.map((c,i) => <Cell key={i} fill={i===0?C.pri:C.acc} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:C.pri }} />
                <span style={{ fontSize:12, color:C.text, fontWeight:700 }}>Returning — {data.customers.returning}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:C.acc }} />
                <span style={{ fontSize:12, color:C.text, fontWeight:700 }}>New — {data.customers.new}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* No-show trend */}
      <Card>
        <SectionHeader icon={AlertTriangle} title="No-Show Rate Trend" color={C.red} />
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.noShowTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F8" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize:10 }} interval={Math.floor(data.noShowTrend.length/5)} />
            <YAxis tick={{ fontSize:10 }} unit="%" />
            <Tooltip labelFormatter={formatDateShort} formatter={(v) => [`${v}%`, "No-show rate"]} />
            <Line type="monotone" dataKey="rate" stroke={C.red} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Peak hours */}
      <Card>
        <SectionHeader icon={Clock} title="Peak Booking Hours" />
        {data.peakHours.length === 0 ? (
          <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"16px 0" }}>Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.peakHours}>
              <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize:10 }} />
              <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
              <Tooltip labelFormatter={formatHour} formatter={(v) => [v, "Bookings"]} />
              <Bar dataKey="count" fill={C.blue} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Staff performance — only for multi-staff stores */}
      {data.hasStaff && (
        <Card>
          <SectionHeader icon={Users} title="Staff Performance" />
          {data.staffPerformance.length === 0 ? (
            <p style={{ fontSize:12, color:C.muted, textAlign:"center", padding:"16px 0" }}>No completed bookings with staff assigned yet.</p>
          ) : (
            data.staffPerformance.map(s => (
              <div key={s.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:"1px solid #F0F2F8" }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:800, color:C.text }}>{s.name}</p>
                  <p style={{ fontSize:11, color:C.muted }}>{s.bookings} bookings</p>
                </div>
                <p style={{ fontSize:14, fontWeight:900, color:C.pri }}>₹{s.revenue}</p>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}