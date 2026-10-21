import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Destination Pin for Customer Location
const customerPinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="marker-pin-wrap">
          <div class="marker-pulse-ring"></div>
          <div class="marker-badge customer-pin">🏠</div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -28],
});

// Technician Pin
const technicianPinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="marker-pin-wrap">
          <div class="marker-badge tech-pin">🛵</div>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -28],
});

// Haversine formula to calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export default function BookingMiniMap({
  latitude,
  longitude,
  address = '',
  area = '',
  technicianLocation = null,
  technicianName = '',
  height = '175px',
}) {
  const destLat = latitude ? Number(latitude) : 25.6207;
  const destLng = longitude ? Number(longitude) : 85.0444;

  const techLat = technicianLocation?.lat ? Number(technicianLocation.lat) : null;
  const techLng = technicianLocation?.lng ? Number(technicianLocation.lng) : null;

  const distanceKm = techLat && techLng ? calculateDistance(techLat, techLng, destLat, destLng) : null;
  const estMins = distanceKm ? Math.max(5, Math.round(distanceKm * 3.5)) : null;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

  return (
    <div className="booking-mini-map-card">
      <div className="mini-map-header">
        <div className="mini-map-title">
          <span className="mini-map-icon">🗺️</span>
          <div>
            <strong>Service Delivery Coordinates</strong>
            <small>{area ? `${area} • ` : ''}{destLat.toFixed(4)}, {destLng.toFixed(4)}</small>
          </div>
        </div>

        {distanceKm !== null && (
          <div className="mini-map-distance-badge">
            <span>⚡ {distanceKm} km</span>
            <small>~{estMins} mins away</small>
          </div>
        )}
      </div>

      <div className="mini-map-frame" style={{ height }}>
        <MapContainer
          center={[destLat, destLng]}
          zoom={13}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          className="leaflet-mini-view"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Customer destination marker */}
          <Marker position={[destLat, destLng]} icon={customerPinIcon}>
            <Popup>
              <div style={{ fontSize: '11px', textAlign: 'center' }}>
                <strong>Customer Location</strong>
                <p style={{ margin: '2px 0 0' }}>{address || area}</p>
              </div>
            </Popup>
          </Marker>

          {/* Technician origin marker if available */}
          {techLat && techLng && (
            <>
              <Marker position={[techLat, techLng]} icon={technicianPinIcon}>
                <Popup>
                  <div style={{ fontSize: '11px', textAlign: 'center' }}>
                    <strong>{technicianName || 'Technician'}</strong>
                    <p style={{ margin: '2px 0 0' }}>Live Location</p>
                  </div>
                </Popup>
              </Marker>
              <Polyline
                positions={[
                  [techLat, techLng],
                  [destLat, destLng],
                ]}
                color="#10b981"
                dashArray="6, 8"
                weight={3}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="mini-map-footer">
        <span className="location-pin-subtext">
          📍 {address ? (address.length > 40 ? `${address.slice(0, 40)}...` : address) : 'Doorstep pinned'}
        </span>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button button-small button-outline nav-directions-link"
          title="Open route in Google Maps app"
        >
          🧭 Navigate in Maps →
        </a>
      </div>
    </div>
  );
}
