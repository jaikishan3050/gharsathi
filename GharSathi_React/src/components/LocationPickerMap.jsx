import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Area coordinates presets (Danapur / Bihta / Patna region)
export const AREA_COORDINATES = {
  'Patna to Danapur': { lat: 25.6207, lng: 85.0444 },
  'Danapur Cantt': { lat: 25.6321, lng: 85.0345 },
  'Bihta': { lat: 25.5658, lng: 84.8631 },
  'Maner': { lat: 25.6486, lng: 84.8778 },
  'Neora': { lat: 25.589, lng: 84.954 },
  'Khagaul': { lat: 25.578, lng: 85.046 },
};

export const DEFAULT_CENTER = { lat: 25.6207, lng: 85.0444 };

// Custom HTML-based Leaflet pin icons (zero external asset dependencies)
export const customerLocationPin = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="marker-pin-wrap">
          <div class="marker-pulse-ring"></div>
          <div class="marker-badge customer-pin">📍</div>
         </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  popupAnchor: [0, -30],
});

// Helper component to handle map clicks and marker dragging
function MapClickHandler({ position, setPosition, onChange }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const newPos = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      setPosition(newPos);
      if (onChange) onChange(newPos);
      map.panTo([newPos.lat, newPos.lng], { animate: true, duration: 0.6 });
    },
  });

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={customerLocationPin}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target;
          const pos = marker.getLatLng();
          const newPos = { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) };
          setPosition(newPos);
          if (onChange) onChange(newPos);
        },
      }}
    >
      <Popup>
        <div style={{ textAlign: 'center', padding: '4px' }}>
          <strong style={{ color: '#0b3d2e', display: 'block', fontSize: '13px' }}>Your House Location</strong>
          <small style={{ color: '#666', fontSize: '11px' }}>Drag pin or click map to adjust</small>
        </div>
      </Popup>
    </Marker>
  );
}

// Helper component to programmatically pan/re-center map
function MapCenterController({ center, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  selectedArea = 'Patna to Danapur',
  disabled = false,
}) {
  const initialPos = latitude && longitude
    ? { lat: Number(latitude), lng: Number(longitude) }
    : AREA_COORDINATES[selectedArea] || DEFAULT_CENTER;

  const [position, setPosition] = useState(initialPos);
  const [mapCenter, setMapCenter] = useState(initialPos);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  // When area changes, automatically jump center to that area
  useEffect(() => {
    if (selectedArea && AREA_COORDINATES[selectedArea]) {
      const areaCoords = AREA_COORDINATES[selectedArea];
      setPosition(areaCoords);
      setMapCenter(areaCoords);
      if (onChange) onChange(areaCoords);
    }
  }, [selectedArea]);

  // HTML5 Geolocation handler
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const userPos = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setPosition(userPos);
        setMapCenter(userPos);
        if (onChange) onChange(userPos);
      },
      (err) => {
        setLocating(false);
        setLocError('Could not get current location. Please tap on map to drop pin.');
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="location-picker-container">
      <div className="picker-header-bar">
        <div className="picker-title-group">
          <span className="picker-tag">📍 INTERACTIVE MAP PIN</span>
          <p className="picker-subtitle">
            Click map or drag the pin to mark your exact doorstep coordinates:
          </p>
        </div>

        <button
          type="button"
          className="button button-small button-outline locate-me-btn"
          onClick={handleLocateMe}
          disabled={locating || disabled}
          title="Detect current GPS location"
        >
          {locating ? '⏳ Detecting GPS...' : '🎯 Locate Me (GPS)'}
        </button>
      </div>

      {locError && <div className="map-error-note">⚠️ {locError}</div>}

      <div className="map-wrapper-box">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={14}
          scrollWheelZoom={false}
          className="leaflet-picker-view"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterController center={mapCenter} zoom={15} />
          <MapClickHandler position={position} setPosition={setPosition} onChange={onChange} />
        </MapContainer>

        <div className="coordinates-badge-bar">
          <span className="coords-text">
            <strong>Pin:</strong> {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
          <span className="coords-hint">Drag pin to calibrate doorstep</span>
        </div>
      </div>
    </div>
  );
}
