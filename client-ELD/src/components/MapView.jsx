// components/MapView.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Navigation, Truck, MapPin } from 'lucide-react';

const MapView = ({ stops = [], tripData = {}, className = '' }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Load CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Load JS
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => {
        console.log('Leaflet loaded successfully');
        setMapReady(true);
      };
      script.onerror = (e) => {
        console.error('Failed to load Leaflet:', e);
        setError('Failed to load map library');
        setLoading(false);
      };
      document.head.appendChild(script);
    } else {
      setMapReady(true);
    }
  }, []);

  // Initialize map when ready
  useEffect(() => {
    if (!mapReady || !window.L || !mapRef.current) return;

    try {
      // Clean up existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Create new map
      const map = window.L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([-1.28333, 36.81667], 8); // Nairobi center

      mapInstanceRef.current = map;

      // Add tile layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      console.log('Map initialized successfully');
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapReady]);

  // Geocode and route when data changes
  useEffect(() => {
    if (!mapReady || !window.L) return;

    const geocodeAndRoute = async () => {
      setLoading(true);
      setError(null);
      const geocodedLocations = [];

      try {
        const locationsToGeocode = [];
        
        if (tripData.currentLocation) {
          locationsToGeocode.push({
            address: tripData.currentLocation,
            type: 'start',
            title: '🚦 Start Location',
            description: tripData.currentLocation
          });
        }

        if (tripData.pickupLocation) {
          locationsToGeocode.push({
            address: tripData.pickupLocation, 
            type: 'pickup',
            title: '📦 Pickup Location',
            description: tripData.pickupLocation
          });
        }

        if (tripData.dropoffLocation) {
          locationsToGeocode.push({
            address: tripData.dropoffLocation,
            type: 'dropoff', 
            title: '📍 Dropoff Location',
            description: tripData.dropoffLocation
          });
        }

        // Geocode locations
        for (let i = 0; i < locationsToGeocode.length; i++) {
          const loc = locationsToGeocode[i];
          const coords = await geocodeAddress(loc.address);
          if (coords) {
            geocodedLocations.push({
              ...coords,
              title: loc.title,
              description: loc.description,
              type: loc.type,
              number: i + 1
            });
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Add stops from route data
        if (stops && Array.isArray(stops)) {
          for (const stop of stops) {
            if (stop.location) {
              const coords = await geocodeAddress(stop.location);
              if (coords) {
                geocodedLocations.push({
                  ...coords,
                  title: stop.title || `Stop ${geocodedLocations.length + 1}`,
                  description: stop.location,
                  type: stop.type || 'default',
                  number: geocodedLocations.length + 1
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }

        setLocations(geocodedLocations);

        // Draw on map
        if (geocodedLocations.length >= 2 && mapInstanceRef.current) {
          await fetchAndDrawRoute(geocodedLocations);
        } else if (geocodedLocations.length > 0 && mapInstanceRef.current) {
          drawMarkersOnly(geocodedLocations);
        }

      } catch (err) {
        console.error('Error in geocoding/routing:', err);
        setError('Failed to load route data');
      } finally {
        setLoading(false);
      }
    };

    if (tripData.currentLocation || stops.length > 0) {
      geocodeAndRoute();
    } else {
      setLoading(false);
    }
  }, [mapReady, stops, tripData]);

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

  const getMarkerIcon = (type, number) => {
    const configs = {
      'start': { color: '#10b981', icon: '🚦' },
      'pickup': { color: '#3b82f6', icon: '📦' },
      'fuel': { color: '#f59e0b', icon: '⛽' },
      'rest': { color: '#8b5cf6', icon: '🛌' },
      'dropoff': { color: '#ef4444', icon: '📍' },
      'default': { color: '#6b7280', icon: '📌' }
    };
    const config = configs[type] || configs.default;
    
    return window.L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="position: relative; width: 48px; height: 48px;">
          <div style="
            position: absolute;
            top: 4px;
            left: 4px;
            background: ${config.color};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">${config.icon}</div>
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid ${config.color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            color: ${config.color};
          ">${number}</div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24]
    });
  };

  const drawMarkersOnly = (locations) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof window.L.Marker || layer instanceof window.L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const bounds = [];

    locations.forEach((loc) => {
      const marker = window.L.marker([loc.lat, loc.lng], {
        icon: getMarkerIcon(loc.type, loc.number)
      }).addTo(map);

      marker.bindPopup(`
        <div style="padding: 8px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${loc.title}</div>
          <div style="font-size: 12px; color: #4b5563;">${loc.description}</div>
        </div>
      `);

      bounds.push([loc.lat, loc.lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  };

  const fetchAndDrawRoute = async (locations) => {
    const map = mapInstanceRef.current;
    if (!map || locations.length < 2) return;

    try {
      const coordinates = locations
        .map(loc => `${loc.lng},${loc.lat}`)
        .join(';');

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
      );
      
      const data = await response.json();
      
      // Clear existing layers
      map.eachLayer((layer) => {
        if (layer instanceof window.L.Marker || layer instanceof window.L.Polyline) {
          map.removeLayer(layer);
        }
      });

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        // Draw route shadow
        window.L.polyline(coords, {
          color: '#1e293b',
          weight: 8,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Draw main route
        window.L.polyline(coords, {
          color: '#4f46e5',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Draw dashed overlay
        window.L.polyline(coords, {
          color: '#ffffff',
          weight: 2,
          opacity: 0.8,
          dashArray: '10, 15',
          lineCap: 'round'
        }).addTo(map);

        setRouteCoordinates(coords);
        setRouteInfo({
          distance: (route.distance / 1609.34).toFixed(1),
          duration: Math.round(route.duration / 60),
          distanceKm: (route.distance / 1000).toFixed(1)
        });

        // Fit bounds to route
        map.fitBounds(coords, { padding: [80, 80] });
      } else {
        // Fallback to straight line
        const straightLine = locations.map(loc => [loc.lat, loc.lng]);
        window.L.polyline(straightLine, {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(map);
        map.fitBounds(straightLine, { padding: [80, 80] });
      }

      // Add markers
      locations.forEach((loc) => {
        const marker = window.L.marker([loc.lat, loc.lng], {
          icon: getMarkerIcon(loc.type, loc.number)
        }).addTo(map);

        marker.bindPopup(`
          <div style="padding: 8px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${loc.title}</div>
            <div style="font-size: 12px; color: #4b5563;">${loc.description}</div>
          </div>
        `);
      });

    } catch (error) {
      console.error('Routing error:', error);
      drawMarkersOnly(locations);
    }
  };

  const getStopColor = (type) => {
    const colors = {
      'start': '#10b981',
      'pickup': '#3b82f6', 
      'fuel': '#f59e0b',
      'rest': '#8b5cf6',
      'dropoff': '#ef4444'
    };
    return colors[type] || '#6b7280';
  };

  return (
    <div className={`relative ${className}`} style={{ height: '500px', width: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: '16px' }} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gradient-to-br from-white via-indigo-50 to-purple-50 bg-opacity-95 flex items-center justify-center rounded-2xl z-[1000]">
          <div className="text-center">
            <div className="relative mx-auto w-16 h-16">
              <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-indigo-900 text-sm font-semibold mt-4 flex items-center gap-2 justify-center">
              <Navigation className="w-4 h-4 animate-pulse" />
              Calculating route on roads...
            </p>
          </div>
        </div>
      )}

      {/* Route info panel */}
      {!loading && routeInfo && (
        <div className="absolute top-4 left-4 bg-white rounded-xl shadow-2xl p-4 z-[1000] border-2 border-indigo-100 max-w-xs">
          <div className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-1.5 rounded-lg">
              <Truck className="w-4 h-4 text-white" />
            </div>
            Route Information
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <span className="text-gray-700 font-medium">Total Distance</span>
              <span className="font-bold text-indigo-600">{routeInfo.distance} miles</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <span className="text-gray-700 font-medium">Est. Duration</span>
              <span className="font-bold text-purple-600">{Math.floor(routeInfo.duration / 60)}h {routeInfo.duration % 60}m</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
              <span className="text-gray-700 font-medium">Total Stops</span>
              <span className="font-bold text-green-600">{locations.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-2xl p-4 z-[1000] border-2 border-indigo-100">
        <div className="font-bold mb-3 text-gray-900 text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-600" />
          Stop Types
        </div>
        <div className="space-y-2">
          {[
            { type: 'start', label: 'Start', icon: '🚦' },
            { type: 'pickup', label: 'Pickup', icon: '📦' },
            { type: 'fuel', label: 'Fuel', icon: '⛽' },
            { type: 'rest', label: 'Rest', icon: '🛌' },
            { type: 'dropoff', label: 'Drop-off', icon: '📍' }
          ].map(({ type, label, icon }) => (
            <div key={type} className="flex items-center gap-3 text-xs">
              <div 
                className="w-4 h-4 rounded-full shadow-md flex items-center justify-center text-[10px]" 
                style={{ 
                  backgroundColor: getStopColor(type),
                  border: '2px solid white'
                }}
              >
                {icon}
              </div>
              <span className="text-gray-700 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-2 rounded-lg z-[1000] shadow-lg text-sm font-semibold">
          {error}
        </div>
      )}

      {/* No data state */}
      {!loading && locations.length === 0 && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl z-[1000]">
          <div className="text-center p-8">
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-indigo-600" />
            </div>
            <p className="text-gray-900 font-bold text-lg mb-2">No Route Data</p>
            <p className="text-gray-600 text-sm">Enter trip details to see the map</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;