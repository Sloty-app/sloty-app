import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { C } from "../constants";

// Custom HTML pin (avoids Leaflet's default marker image path, which
// breaks under Vite/webpack bundling without extra asset config).
const pinIcon = (color) => L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const userPin   = pinIcon("#3B9EFF");
const storePin  = pinIcon("#FF5E7D");

const FALLBACK_CENTER = [20.5937, 78.9629]; // geographic center of India

export default function StoreMapView({ stores, userLocation, onSelectStore }) {
  const withCoords = stores.filter(s => s.location?.lat && s.location?.lng);

  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : withCoords[0]
      ? [withCoords[0].location.lat, withCoords[0].location.lng]
      : FALLBACK_CENTER;

  return (
    <div style={{ height: "calc(100vh - 230px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userPin}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {withCoords.map(store => (
          <Marker key={store._id} position={[store.location.lat, store.location.lng]} icon={storePin}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "'Nunito',sans-serif" }}>
                <p style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>{store.name}</p>
                <p style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{store.area || store.city}</p>
                <button
                  onClick={() => onSelectStore(store)}
                  style={{ width: "100%", padding: "7px", background: C.pri, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Nunito',sans-serif" }}
                >
                  View Store
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {withCoords.length === 0 && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "10px 18px", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", fontSize: 12, fontWeight: 700, color: C.muted }}>
          None of these stores have a precise location set yet
        </div>
      )}
    </div>
  );
}