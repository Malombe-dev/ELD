// components/MapView.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Component to auto-fit map bounds
function MapBounds({ locations }) {
  const map = useMap();
  
  useEffect(() => {
    if (locations && locations.length > 0) {
      const validLocations = locations.filter(loc => loc.lat && loc.lng);
      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(validLocations.map(loc => [loc.lat, loc.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [locations, map]);
  
  return null;
}

// Custom icon function
const createCustomIcon = (color, number) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
      ">${number}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

const getStopColor = (type) => {
  const colors = {
    'start': '#10b981',
    'pickup': '#3b82f6', 
    'fuel': '#f59e0b',
    'rest': '#8b5cf6',
    'dropoff': '#ef4444',
    'default': '#6b7280'
  };
  return colors[type] || colors.default;
};

const MapView = ({ stops = [], tripData = {}, className = '' }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const geocodeLocations = async () => {
      setLoading(true);
      const geocodedLocations = [];

      // Add main trip locations
      const locationsToGeocode = [];
      
      if (tripData.currentLocation) {
        locationsToGeocode.push({
          address: tripData.currentLocation,
          type: 'start',
          title: '🚦 Start Location'
        });
      }

      if (tripData.pickupLocation) {
        locationsToGeocode.push({
          address: tripData.pickupLocation, 
          type: 'pickup',
          title: '📦 Pickup Location'
        });
      }

      if (tripData.dropoffLocation) {
        locationsToGeocode.push({
          address: tripData.dropoffLocation,
          type: 'dropoff', 
          title: '📍 Dropoff Location'
        });
      }

      // Geocode all locations
      for (let i = 0; i < locationsToGeocode.length; i++) {
        const loc = locationsToGeocode[i];
        const coords = await geocodeAddress(loc.address);
        if (coords) {
          geocodedLocations.push({
            ...coords,
            title: loc.title,
            description: loc.address,
            type: loc.type,
            number: i + 1
          });
        }
      }

      // Add stops from route data
      if (stops && Array.isArray(stops)) {
        stops.forEach((stop, index) => {
          if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
            geocodedLocations.push({
              lat: stop.coordinates[0],
              lng: stop.coordinates[1],
              title: stop.title || `Stop ${index + 1}`,
              description: stop.location || '',
              type: stop.type || 'default',
              number: geocodedLocations.length + 1
            });
          }
        });
      }

      setLocations(geocodedLocations);
      setLoading(false);
    };

    geocodeLocations();
  }, [stops, tripData]);

  const geocodeAddress = async (address) => {
    if (!address) return null;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'ELD-Log-Generator/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  // Default center - use Nairobi since your locations are in Kenya
  const defaultCenter = [-1.28333, 36.81667]; // Nairobi coordinates
  const center = locations.length > 0 
    ? [locations[0].lat, locations[0].lng] 
    : defaultCenter;

  // Create route line from locations
  const routeLine = locations
    .filter(loc => loc.lat && loc.lng)
    .map(loc => [loc.lat, loc.lng]);

  return (
    <div className={`relative ${className}`} style={{ height: '500px', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={8}
        style={{ height: '100%', width: '100%', borderRadius: '12px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route line */}
        {routeLine.length > 1 && (
          <Polyline 
            positions={routeLine} 
            color="#4f46e5" 
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Markers */}
        {locations.map((location, index) => (
          <Marker
            key={index}
            position={[location.lat, location.lng]}
            icon={createCustomIcon(getStopColor(location.type), location.number)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold text-base mb-1">{location.title}</div>
                <div className="text-gray-700">{location.description}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit bounds */}
        <MapBounds locations={locations} />
      </MapContainer>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-lg z-[1000]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading map...</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs z-[1000]">
        <div className="font-semibold mb-2 text-gray-900">Legend</div>
        <div className="space-y-1">
          {['start', 'pickup', 'fuel', 'rest', 'dropoff'].map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: getStopColor(type) }}
              ></div>
              <span className="text-gray-700 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* No data state */}
      {!loading && locations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-[1000]">
          <div className="text-center text-gray-500">
            <p className="text-sm">No route data available</p>
            <p className="text-xs mt-1">Enter trip details and calculate route</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;