import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Truck, Clock, FileText, AlertCircle, Download, Play, Coffee, Moon, Save, Printer, Navigation } from 'lucide-react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// MapView Component (unchanged)
const MapView = ({ stops, tripData, currentLocation, statusHistory, className }) => {
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapLoaded(true);
      script.onerror = () => setMapError('Failed to load map library');
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.L || !mapRef.current) return;

    try {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = window.L.map(mapRef.current).setView([39.8283, -98.5795], 4);
      mapInstanceRef.current = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      const geocodeAndAddMarkers = async () => {
        const locations = [];
        
        if (currentLocation) {
          const coords = await geocodeLocation(currentLocation);
          if (coords) {
            locations.push({
              coords,
              title: '📍 Current Position',
              type: 'current',
              popup: `<strong>Current Location</strong><br/>${currentLocation}`
            });
          }
        }

        if (stops && Array.isArray(stops)) {
          for (const stop of stops) {
            const coords = await geocodeLocation(stop.location);
            if (coords) {
              locations.push({
                coords,
                title: stop.title,
                type: stop.type,
                popup: `<strong>${stop.title}</strong><br/>${stop.location}<br/><em>${stop.time || ''}</em>`
              });
            }
          }
        } else if (tripData) {
          const locationsList = [
            { location: tripData.currentLocation, title: '🚦 Start', type: 'start' },
            { location: tripData.pickupLocation, title: '📦 Pickup', type: 'pickup' },
            { location: tripData.dropoffLocation, title: '📍 Dropoff', type: 'dropoff' }
          ];

          for (const loc of locationsList) {
            if (loc.location) {
              const coords = await geocodeLocation(loc.location);
              if (coords) {
                locations.push({
                  coords,
                  title: loc.title,
                  type: loc.type,
                  popup: `<strong>${loc.title}</strong><br/>${loc.location}`
                });
              }
            }
          }
        }

        if (locations.length > 0) {
          const bounds = [];
          const routeCoords = [];

          locations.forEach((loc, index) => {
            const icon = getMarkerIcon(loc.type);
            const marker = window.L.marker(loc.coords, { icon }).addTo(map);
            marker.bindPopup(loc.popup);
            bounds.push(loc.coords);
            routeCoords.push(loc.coords);

            if (index > 0 && loc.type !== 'current') {
              window.L.marker(loc.coords, {
                icon: window.L.divIcon({
                  className: 'custom-number-icon',
                  html: `<div style="background: white; border: 2px solid #4F46E5; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #4F46E5; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${index}</div>`,
                  iconSize: [26, 26]
                })
              }).addTo(map);
            }
          });

          if (routeCoords.length > 1) {
            window.L.polyline(routeCoords, {
              color: '#4F46E5',
              weight: 5,
              opacity: 0.8,
              dashArray: '10, 10',
              lineJoin: 'round'
            }).addTo(map);
          }

          if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [60, 60] });
          }
        }
      };

      geocodeAndAddMarkers();

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (error) {
      console.error('Map error:', error);
      setMapError('Failed to initialize map');
    }
  }, [mapLoaded, stops, tripData, currentLocation, statusHistory]);

  const geocodeLocation = async (location) => {
    if (!location) return null;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    
    return null;
  };

  const getMarkerIcon = (type) => {
    const colors = {
      start: '#10B981',
      current: '#3B82F6',
      pickup: '#6366F1',
      fuel: '#F59E0B',
      rest: '#8B5CF6',
      dropoff: '#EF4444',
      default: '#6B7280'
    };

    const color = colors[type] || colors.default;

    return window.L.divIcon({
      className: 'custom-marker-icon',
      html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4);"></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  if (mapError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200`}>
        <div className="text-center p-8">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">{mapError}</p>
        </div>
      </div>
    );
  }

  if (!mapLoaded) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-indigo-700 font-semibold">Loading interactive map...</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={className} style={{ minHeight: '400px' }} />;
};

// Main App Component
export default function ELDLogGenerator() {
  const [activeTab, setActiveTab] = useState('input');
  const [tripData, setTripData] = useState({
    driverName: '',
    carrierName: '',
    carrierAddress: '',
    homeTerminal: '',
    vehicleNumber: '',
    trailerNumber: '',
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleHours: 0,
    startTime: new Date().toTimeString().slice(0, 5) 
  });
  
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [upcomingStops, setUpcomingStops] = useState([]);
  
  const [currentStatus, setCurrentStatus] = useState('off');
  const [currentLocation, setCurrentLocation] = useState('');
  const [statusHistory, setStatusHistory] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [currentDayLog, setCurrentDayLog] = useState({
    date: new Date().toLocaleDateString(),
    segments: [],
    totalMiles: 0,
    summary: { offDuty: 0, sleeper: 0, driving: 0, onDuty: 0 },
    tripData: null
  });

  const [lastStatusChangeTime, setLastStatusChangeTime] = useState(new Date());
  const [currentDuration, setCurrentDuration] = useState('0h 0m 0s');
  const timerRef = useRef(null);

  useEffect(() => {
    const startTime = new Date();
    setLastStatusChangeTime(startTime);
    setStatusHistory([{
      time: startTime,
      status: 'off',
      location: 'Starting shift',
      type: 'auto',
      duration: 0
    }]);
    
    loadSavedLogs();
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentDuration(calculateCurrentDuration(lastStatusChangeTime));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [lastStatusChangeTime]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTripData(prev => ({
      ...prev,
      [name]: name === 'currentCycleHours' ? parseFloat(value) || 0 : value
    }));
  };

  const changeStatus = (newStatus, location = '') => {
    const changeTime = new Date();
    const previousStatus = currentStatus;
    const previousChangeTime = lastStatusChangeTime;
    
    const durationMinutes = (changeTime - previousChangeTime) / (1000 * 60);
    const durationHours = durationMinutes / 60;

    const newEntry = {
      time: changeTime,
      status: newStatus,
      location: location || currentLocation || getStatusDescription(newStatus),
      type: 'manual',
      previousStatus: previousStatus,
      duration: durationHours
    };
    
    
    setStatusHistory(prev => {
      const newHistory = [...prev, newEntry];
      return newHistory;
    });
    
    setCurrentStatus(newStatus);
    setLastStatusChangeTime(changeTime);
    updateLogSegments(previousStatus, durationHours, previousChangeTime, changeTime);
    
    if (location) {
      setCurrentLocation(location);
    }
  };

  const updateLogSegments = (previousStatus, durationHours, startTime, endTime) => {
    const statusMap = { 'off': 0, 'sleeper': 1, 'driving': 2, 'on': 3 };
    
    setCurrentDayLog(prev => {
      const newSegments = [...prev.segments];
      
      if (durationHours > 0.01) {
        // Calculate hour positions correctly
        const startHour = startTime.getHours() + startTime.getMinutes() / 60;
        const endHour = endTime.getHours() + endTime.getMinutes() / 60;
        
        newSegments.push({
          status: statusMap[previousStatus],
          duration: durationHours,
          startTime: startTime,
          endTime: endTime,
          start: startHour,
          end: endHour
        });
      }
      
      const summary = calculateTotalsFromSegments(newSegments);
      
      return {
        ...prev,
        segments: newSegments,
        summary
      };
    });
  };

  // FIX: New function to get hour position from time
  const getHourPosition = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return hours + minutes / 60;
  };

  const calculateTotalsFromSegments = (segments) => {
    const totals = { offDuty: 0, sleeper: 0, driving: 0, onDuty: 0 };
    const statusKeys = ['offDuty', 'sleeper', 'driving', 'onDuty'];
    
    segments.forEach(segment => {
      if (segment.duration) {
        totals[statusKeys[segment.status]] += segment.duration;
      }
    });
    
    Object.keys(totals).forEach(key => {
      totals[key] = Math.round(totals[key] * 100) / 100;
    });
    
    return totals;
  };

  const calculateRoute = async () => {
    setLoading(true);
    setError(null);
    
    if (!tripData.currentLocation || !tripData.pickupLocation || !tripData.dropoffLocation) {
      setError('Please fill in all location fields');
      setLoading(false);
      return;
    }
    
    try {
      // FIX: Send start time to backend
      const response = await fetch(`${API_BASE_URL}/api/calculate-route/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: tripData.currentLocation,
          destination: tripData.dropoffLocation,
          waypoints: tripData.pickupLocation ? [tripData.pickupLocation] : [],
          current_cycle_hours: tripData.currentCycleHours,
          driver_name: tripData.driverName || 'Driver',
          carrier_name: tripData.carrierName || 'Carrier',
          start_time: tripData.startTime // FIX: Include start time
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.stops || !Array.isArray(data.stops)) {
        throw new Error('Invalid response format from server');
      }
      
      setRouteData(data);
      setActiveTab('route');
      setError(null);

      if (data.stops) {
        const stopsForLogging = data.stops.map(stop => ({
          type: stop.type,
          location: stop.location,
          time: stop.time,
          duration: stop.duration,
          notes: stop.notes
        }));
        setUpcomingStops(stopsForLogging);
      }
    } catch (err) {
      console.error('Route calculation error:', err);
      setError(err.message || 'Failed to calculate route. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver-logs/`);
      if (response.ok) {
        const logs = await response.json();
        setDailyLogs(Array.isArray(logs) ? logs : []);
      }
    } catch (error) {
      console.error('Error loading saved logs:', error);
    }
  };

  const finalizeDailyLog = async () => {
    try {
      const finalTime = new Date();
      
      const durationMinutes = (finalTime - lastStatusChangeTime) / (1000 * 60);
      const durationHours = durationMinutes / 60;
      
      const finalSegments = [...currentDayLog.segments];
      const statusMap = { 'off': 0, 'sleeper': 1, 'driving': 2, 'on': 3 };
      
      // Add the current ongoing segment
      if (durationHours > 0.01) {
        const startHour = getHourPosition(lastStatusChangeTime);
        const endHour = getHourPosition(finalTime);
        
        finalSegments.push({
          status: statusMap[currentStatus],
          duration: durationHours,
          startTime: lastStatusChangeTime,
          endTime: finalTime,
          start: startHour,
          end: endHour,
          location: currentLocation || 'Unknown location'
        });
      }
  
      const finalSummary = calculateTotalsFromSegments(finalSegments);
      const totalMiles = calculateTotalMiles(finalSegments);
  
      // ✅ FIX: Create a COMPLETE tripData object with ALL fields
      const completeTripData = {
        // Location fields
        currentLocation: tripData.currentLocation || '',
        pickupLocation: tripData.pickupLocation || '',
        dropoffLocation: tripData.dropoffLocation || '',
        
        // Driver and carrier info
        driverName: tripData.driverName || '',
        carrierName: tripData.carrierName || '',
        carrierAddress: tripData.carrierAddress || '',
        homeTerminal: tripData.homeTerminal || '',
        
        // Vehicle info
        vehicleNumber: tripData.vehicleNumber || '',
        trailerNumber: tripData.trailerNumber || '',
        
        // Timing and hours
        currentCycleHours: tripData.currentCycleHours || 0,
        startTime: tripData.startTime || ''
      };
  
      // ✅ FIX: Create the finalized log with COMPLETE data
      const finalizedLog = {
        date: new Date().toLocaleDateString(),
        segments: finalSegments.map(seg => ({
          status: seg.status,
          start: seg.start,
          end: seg.end,
          duration: seg.duration,
          location: seg.location || '',
          startTime: seg.startTime?.toISOString(),
          endTime: seg.endTime?.toISOString()
        })),
        summary: finalSummary,
        tripData: completeTripData, // ✅ Use the complete object
        statusHistory: statusHistory.map(entry => ({
          ...entry,
          time: entry.time.toISOString()
        })),
        finalizedAt: finalTime.toISOString(),
        totalMiles: totalMiles,
        remarks: generateRemarksFromActivity(finalSummary)
      };
  
      // ✅ DEBUG: Log the COMPLETE data we're saving
      console.log('=== FINALIZING LOG - COMPLETE DATA ===');
      console.log('Complete tripData being saved:', completeTripData);
      console.log('All tripData fields available:', Object.keys(tripData));
      console.log('Finalized log tripData:', finalizedLog.tripData);
      console.log('Total Miles:', totalMiles);
      console.log('Summary:', finalSummary);
  
      try {
        console.log('📤 Sending to:', `${API_BASE_URL}/api/save-log/`); 
        
        const saveResponse = await fetch(`${API_BASE_URL}/api/save-log/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(finalizedLog)
        });
  
        console.log('📤 API Response status:', saveResponse.status); // ADD THIS
        
        if (saveResponse.ok) {
          const savedLog = await saveResponse.json();
          console.log('✅ Backend response:', savedLog); // ADD THIS
          setDailyLogs(prev => [...prev, savedLog]);
          alert('✅ Daily log finalized and saved successfully!');
        } else {
          const errorData = await saveResponse.json();
          console.error('❌ Save error:', errorData);
          // Fallback: save locally with COMPLETE data
          console.log('💾 Saving locally instead...');
          setDailyLogs(prev => [...prev, finalizedLog]);
          alert('✅ Daily log saved locally!');
        }
      } catch (apiError) {
        console.log('❌ API save failed:', apiError);
        console.log('💾 Saving locally instead...');
        setDailyLogs(prev => [...prev, finalizedLog]);
        alert('✅ Daily log saved locally!');
      }
      
      resetForNewDay();
      setActiveTab('logs');
    } catch (error) {
      console.error('Error saving log:', error);
      alert(`Error saving log: ${error.message}. Please try again.`);
    }
  };

  const calculateTotalMiles = (segments) => {
    const drivingHours = segments
      .filter(seg => seg.status === 2) 
      .reduce((sum, seg) => sum + (seg.duration || 0), 0);
    return Math.round(drivingHours * 55);
  };

  const generateRemarksFromActivity = (summary) => {
    const drivingTime = summary.driving || 0;
    const locations = statusHistory
      .filter(entry => entry.location && entry.location !== getStatusDescription(entry.status))
      .map(entry => entry.location)
      .filter((location, index, self) => self.indexOf(location) === index);
    
    const locationStr = locations.length > 0 ? locations.slice(0, 3).join(', ') : 'Various locations';
    const pickupStr = tripData.pickupLocation ? ` Pickup at ${tripData.pickupLocation}.` : '';
    
    return `Drove ${drivingTime.toFixed(1)}h. Locations: ${locationStr}.${pickupStr}`;
  };

  const resetForNewDay = () => {
    setTripData({
      driverName: '',
      carrierName: '',
      carrierAddress: '',
      homeTerminal: '',
      vehicleNumber: '',
      trailerNumber: '',
      currentLocation: '',
      pickupLocation: '',
      dropoffLocation: '',
      currentCycleHours: 0,
      startTime: new Date().toTimeString().slice(0, 5)
    });
    
    setRouteData(null);
    
    setCurrentDayLog({
      date: new Date().toLocaleDateString(),
      segments: [],
      totalMiles: 0,
      summary: { offDuty: 0, sleeper: 0, driving: 0, onDuty: 0 },
      tripData: null
    });
    
    const startTime = new Date();
    setStatusHistory([{
      time: startTime,
      status: 'off',
      location: 'Starting new day',
      type: 'auto',
      duration: 0
    }]);
    setCurrentStatus('off');
    setLastStatusChangeTime(startTime);
    setCurrentLocation('');
    
    setActiveTab('input');
  };

  const downloadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/download-logs-pdf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: dailyLogs })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eld-logs-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('✅ PDF downloaded successfully!');
        return;
      }
    } catch (error) {
      console.log('PDF generation unavailable, downloading JSON');
    }
    
    // Fallback to JSON
    const logsData = JSON.stringify(dailyLogs, null, 2);
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eld-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('✅ Logs downloaded as JSON (PDF generation requires backend support)');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <header className="bg-white shadow-lg border-b-4 border-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">ELD Log Generator</h1>
                <p className="text-sm text-indigo-600 font-semibold">Hours of Service Compliance Tool</p>
              </div>
            </div>
            
            {currentStatus && (
              <div className="flex items-center gap-4 bg-gradient-to-br from-gray-50 to-gray-100 px-6 py-3 rounded-xl border-2 border-gray-200 shadow-md">
                <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${
                  currentStatus === 'driving' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' :
                  currentStatus === 'on' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white' :
                  currentStatus === 'sleeper' ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white' :
                  'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                }`}>
                  {getStatusDisplay(currentStatus)}
                </div>
                <div className="text-sm">
                  <div className="text-gray-600 font-medium">Duration</div>
                  <div className="font-bold text-gray-900 text-lg">{currentDuration}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-2xl shadow-xl p-2 flex gap-2">
          <TabButton 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')}
            icon={<MapPin className="w-5 h-5" />}
            label="Trip Planning"
          />
          <TabButton 
            active={activeTab === 'route'} 
            onClick={() => setActiveTab('route')}
            icon={<Clock className="w-5 h-5" />}
            label="Route & Stops"
            disabled={!routeData}
          />
          <TabButton 
            active={activeTab === 'realtime'} 
            onClick={() => setActiveTab('realtime')}
            icon={<Play className="w-5 h-5" />}
            label="Live Logging"
          />
          <TabButton 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')}
            icon={<FileText className="w-5 h-5" />}
            label="Generated Logs"
            badge={dailyLogs.length}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'input' && (
          <TripInputForm 
            tripData={tripData}
            handleInputChange={handleInputChange}
            calculateRoute={calculateRoute}
            loading={loading}
            error={error}
          />
        )}
        
        {activeTab === 'route' && routeData && (
          <RouteDisplay routeData={routeData} tripData={tripData} />
        )}
        
        {activeTab === 'realtime' && (
          <RealTimeLogging
            currentStatus={currentStatus}
            currentLocation={currentLocation}
            statusHistory={statusHistory}
            currentLog={currentDayLog}
            tripData={tripData}
            routeData={routeData}
            upcomingStops={upcomingStops}
            onStatusChange={changeStatus}
            onLocationChange={setCurrentLocation}
            onFinalizeLog={finalizeDailyLog}
            lastStatusChangeTime={lastStatusChangeTime}
            currentDuration={currentDuration}
          />
        )}
        
        {activeTab === 'logs' && (
          <GeneratedLogsDisplay 
            dailyLogs={dailyLogs}
            onDownload={downloadLogs}
          />
        )}
      </div>
    </div>
  );
}

function getStatusDisplay(status) {
  const statusMap = {
    'off': 'Off Duty',
    'sleeper': 'Sleeper Berth',
    'driving': 'Driving',
    'on': 'On Duty'
  };
  return statusMap[status] || 'Unknown';
}

function getStatusDescription(status) {
  const descMap = {
    'off': 'Off duty activities',
    'sleeper': 'In sleeper berth',
    'driving': 'Driving vehicle',
    'on': 'On duty not driving'
  };
  return descMap[status] || 'Status change';
}

function calculateCurrentDuration(startTime) {
  const now = new Date();
  const diffMinutes = (now - startTime) / (1000 * 60);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = Math.floor(diffMinutes % 60);
  const seconds = Math.floor((diffMinutes * 60) % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function TabButton({ active, onClick, icon, label, disabled, badge }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all relative ${
        active 
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105' 
          : disabled 
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
          : 'text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:scale-102'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
          {badge}
        </span>
      )}
    </button>
  );
}

function InputField({ label, icon, ...props }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={`block w-full py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all hover:border-indigo-300 ${
            icon ? 'pl-10 pr-4' : 'px-4'
          }`}
        />
      </div>
    </div>
  );
}

function TripInputForm({ tripData, handleInputChange, calculateRoute, loading, error }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-indigo-100 to-purple-100 p-3 rounded-xl">
          <MapPin className="w-7 h-7 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Enter Trip Details</h2>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <InputField label="Driver Name" name="driverName" value={tripData.driverName} onChange={handleInputChange} placeholder="e.g., John Doe" />
        <InputField label="Carrier Name" name="carrierName" value={tripData.carrierName} onChange={handleInputChange} placeholder="e.g., Transport Co." />
        <InputField label="Carrier Address" name="carrierAddress" value={tripData.carrierAddress} onChange={handleInputChange} placeholder="e.g., 123 Main St" />
        <InputField label="Home Terminal" name="homeTerminal" value={tripData.homeTerminal} onChange={handleInputChange} placeholder="e.g., Terminal Address" />
        <InputField label="Vehicle Number" name="vehicleNumber" value={tripData.vehicleNumber} onChange={handleInputChange} placeholder="e.g., V-1234" />
        <InputField label="Trailer Number" name="trailerNumber" value={tripData.trailerNumber} onChange={handleInputChange} placeholder="e.g., T-5678" />
      </div>

      <div className="border-t-2 border-gray-200 pt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Navigation className="w-6 h-6 text-indigo-600" />
          Trip Locations & Timing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="Current Location" name="currentLocation" value={tripData.currentLocation} onChange={handleInputChange} placeholder="e.g., New York, NY" icon={<MapPin className="w-5 h-5 text-indigo-600" />} />
          <InputField label="Pickup Location" name="pickupLocation" value={tripData.pickupLocation} onChange={handleInputChange} placeholder="e.g., Chicago, IL" icon={<MapPin className="w-5 h-5 text-blue-600" />} />
          <InputField label="Drop-off Location" name="dropoffLocation" value={tripData.dropoffLocation} onChange={handleInputChange} placeholder="e.g., Los Angeles, CA" icon={<MapPin className="w-5 h-5 text-red-600" />} />
          <InputField label="Current Cycle Hours Used" name="currentCycleHours" type="number" value={tripData.currentCycleHours} onChange={handleInputChange} placeholder="0-70" min="0" max="70" step="0.5" icon={<Clock className="w-5 h-5 text-purple-600" />} />
          <InputField label="Trip Start Time" name="startTime" type="time" value={tripData.startTime} onChange={handleInputChange} icon={<Clock className="w-5 h-5 text-green-600" />} />
        </div>
      </div>

      <div className="mt-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2">
          📋 <span>Next Steps:</span>
        </h3>
        <ul className="text-sm text-indigo-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold text-indigo-600">1.</span>
            <span>Enter your trip details above (including start time for accurate scheduling)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-indigo-600">2.</span>
            <span>Click "Calculate Route" to plan your trip with HOS-compliant stops</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-indigo-600">3.</span>
            <span>Go to "Live Logging" to track your actual hours in real-time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-indigo-600">4.</span>
            <span>Use status buttons throughout your shift to log activities</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-indigo-600">5.</span>
            <span>Finalize log at end of day to generate official ELD logs</span>
          </li>
        </ul>
      </div>

      <button
        onClick={calculateRoute}
        disabled={loading || !tripData.currentLocation || !tripData.pickupLocation || !tripData.dropoffLocation}
        className="mt-8 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-102 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            Calculating HOS-Compliant Route...
          </>
        ) : (
          <>
            <Clock className="w-6 h-6" />
            Calculate Route with Stops
          </>
        )}
      </button>
    </div>
  );
}

function RealTimeLogging({ 
  currentStatus, 
  currentLocation,
  statusHistory, 
  currentLog,
  tripData, 
  routeData,
  upcomingStops,
  onStatusChange, 
  onLocationChange,
  onFinalizeLog, 
  currentDuration }) {

    const getNextStop = () => {
      if (!upcomingStops || upcomingStops.length === 0) return null;
      
      const now = new Date();
      for (const stop of upcomingStops) {
        const isLogged = statusHistory.some(entry => 
          entry.location && entry.location.includes(stop.location)
        );
        if (!isLogged) return stop;
      }
      return null;
    };
  
    const nextStop = getNextStop(); 
    
  return (
    <div className="space-y-6">
      {nextStop && nextStop.type !== 'start' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="bg-amber-400 p-3 rounded-xl">
              {nextStop.type === 'fuel' && <Coffee className="w-7 h-7 text-white" />}
              {nextStop.type === 'rest' && <Moon className="w-7 h-7 text-white" />}
              {nextStop.type === 'pickup' && <MapPin className="w-7 h-7 text-white" />}
              {nextStop.type === 'dropoff' && <MapPin className="w-7 h-7 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-amber-900 mb-2">
                📍 Upcoming: {nextStop.type === 'fuel' ? 'Fuel Stop' : 
                             nextStop.type === 'rest' ? 'Rest Break' : 
                             nextStop.type === 'pickup' ? 'Pickup Location' : 'Next Stop'}
              </h3>
              <p className="text-amber-800 font-medium">
                <strong>Location:</strong> {nextStop.location}
              </p>
              <p className="text-amber-700 text-sm mt-1">
                <strong>Scheduled Time:</strong> {nextStop.time}
              </p>
              {nextStop.duration && (
                <p className="text-amber-700 text-sm">
                  <strong>Duration:</strong> {nextStop.duration}
                </p>
              )}
              {nextStop.notes && (
                <p className="text-amber-600 text-sm italic mt-2">{nextStop.notes}</p>
              )}
              <button
                onClick={() => {
                  const suggestedStatus = nextStop.type === 'fuel' ? 'on' : 
                                         nextStop.type === 'rest' ? 'sleeper' : 'on';
                  onStatusChange(suggestedStatus, nextStop.location);
                }}
                className="mt-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-2 rounded-lg hover:from-amber-600 hover:to-orange-700 font-bold shadow-md flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Log Arrival at This Stop
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-xl">
              <Play className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Live Logging</h2>
              <p className="text-sm text-gray-600 font-medium">{currentLog.date}</p>
            </div>
          </div>
          <button
            onClick={onFinalizeLog}
            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            Finalize Today's Log
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Change Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <StatusButton
                status="off"
                current={currentStatus}
                onClick={() => onStatusChange('off', currentLocation)}
                icon={<Coffee className="w-6 h-6" />}
                label="Off Duty"
                color="from-green-500 to-emerald-600"
              />
              <StatusButton
                status="sleeper"
                current={currentStatus}
                onClick={() => onStatusChange('sleeper', currentLocation)}
                icon={<Moon className="w-6 h-6" />}
                label="Sleeper"
                color="from-purple-500 to-violet-600"
              />
              <StatusButton
                status="on"
                current={currentStatus}
                onClick={() => onStatusChange('on', currentLocation)}
                icon={<FileText className="w-6 h-6" />}
                label="On Duty"
                color="from-yellow-500 to-amber-600"
              />
              <StatusButton
                status="driving"
                current={currentStatus}
                onClick={() => onStatusChange('driving', currentLocation)}
                icon={<Truck className="w-6 h-6" />}
                label="Driving"
                color="from-red-500 to-rose-600"
              />
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Current Location
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => onLocationChange(e.target.value)}
                  placeholder="Enter your current location..."
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={() => onStatusChange(currentStatus, currentLocation)}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-lg"
                >
                  Update
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
              <div className="text-sm text-blue-900">
                <div className="font-bold text-lg mb-1">Current Status: {getStatusDisplay(currentStatus)}</div>
                <div className="flex items-center justify-between">
                  <span>Duration: {currentDuration}</span>
                  <span className="text-xs text-blue-700">Started: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Totals</h3>
            <div className="grid grid-cols-2 gap-3">
              <TotalCard label="Off Duty" value={currentLog.summary.offDuty} color="from-green-100 to-emerald-100" textColor="text-green-800" />
              <TotalCard label="Sleeper" value={currentLog.summary.sleeper} color="from-purple-100 to-violet-100" textColor="text-purple-800" />
              <TotalCard label="Driving" value={currentLog.summary.driving} color="from-red-100 to-rose-100" textColor="text-red-800" />
              <TotalCard label="On Duty" value={currentLog.summary.onDuty} color="from-yellow-100 to-amber-100" textColor="text-yellow-800" />
            </div>
            
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Current Trip
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">From:</span> {tripData.currentLocation || 'Not specified'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">To:</span> {tripData.dropoffLocation || 'Not specified'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Pickup:</span> {tripData.pickupLocation || 'Not specified'}
                </div>
              </div>
            </div>

            <div className={`mt-4 p-4 rounded-xl border-2 ${
              currentLog.summary.driving < 11 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
            }`}>
              <div className={`flex items-center gap-3 text-sm ${
                currentLog.summary.driving < 11 ? 'text-green-900' : 'text-red-900'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  currentLog.summary.driving < 11 ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'
                }`}></div>
                <span className="font-bold text-base">
                  {currentLog.summary.driving < 11 ? '✅ HOS Compliant' : '⚠️ HOS Violation'}
                </span>
                <span className="ml-auto font-semibold">
                  Driving: {currentLog.summary.driving.toFixed(1)}h / 11h max
                </span>
              </div>
            </div>

            {/* Planned Route Stops */}
            {upcomingStops && upcomingStops.length > 0 && (
              <div className="mt-4">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Planned Route Stops
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {upcomingStops.map((stop, index) => {
                    const isLogged = statusHistory.some(entry => 
                      entry.location && entry.location.includes(stop.location)
                    );
                    return (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border-2 text-sm ${
                          isLogged 
                            ? 'bg-green-50 border-green-300 opacity-60' 
                            : 'bg-blue-50 border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isLogged ? '✅' : '📍'}
                            <span className="font-semibold">
                              {stop.type === 'fuel' ? '⛽ Fuel' : 
                               stop.type === 'rest' ? '🛌 Rest' : 
                               stop.type === 'pickup' ? '📦 Pickup' : 
                               stop.type === 'dropoff' ? '📍 Dropoff' : 
                               '🚦 ' + stop.type}
                            </span>
                          </div>
                          <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                            {stop.time}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{stop.location}</div>
                        {stop.duration && (
                          <div className="text-xs text-gray-500 mt-1">
                            Duration: {stop.duration}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            Status History
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {statusHistory.slice().reverse().map((entry, index) => (
              <div key={index} className="flex items-center gap-4 py-3 px-4 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                <span className="font-mono text-sm bg-gradient-to-r from-indigo-100 to-purple-100 px-3 py-1.5 rounded-lg font-semibold text-indigo-700">
                  {entry.time.toLocaleTimeString()}
                </span>
                <span className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm ${
                  entry.status === 'driving' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' :
                  entry.status === 'on' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white' :
                  entry.status === 'sleeper' ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white' :
                  'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                }`}>
                  {getStatusDisplay(entry.status)}
                </span>
                <span className="text-gray-700 flex-1 text-sm font-medium">{entry.location}</span>
                {entry.duration > 0 && (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{entry.duration.toFixed(1)}h</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Today's Log Preview
          </h2>
          <ELDLogGrid segments={currentLog.segments} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-indigo-600" />
          Live Route Map
        </h2>
        <MapView 
          stops={routeData?.stops} 
          tripData={tripData}
          currentLocation={currentLocation}
          statusHistory={statusHistory}
          className="h-96 rounded-2xl border-2 border-gray-200 shadow-inner"
        />
      </div>
    </div>
  );
}

function StatusButton({ status, current, onClick, icon, label, color }) {
  const isActive = current === status;
  
  return (
    <button
      onClick={onClick}
      className={`p-5 rounded-xl text-white font-bold transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 ${
        isActive ? 'ring-4 ring-white ring-opacity-50 scale-105' : ''
      } bg-gradient-to-r ${color}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TotalCard({ label, value, color, textColor }) {
  return (
    <div className={`bg-gradient-to-br ${color} p-4 rounded-xl text-center border-2 border-white shadow-md`}>
      <div className={`text-sm font-bold ${textColor}`}>{label}</div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value.toFixed(1)}h</div>
    </div>
  );
}

function RouteDisplay({ routeData, tripData }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">Route Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Distance" value={`${routeData.totalDistance || '0'} miles`} icon="🛣️" />
          <StatCard label="Total Duration" value={routeData.totalDuration || '0h'} icon="⏱️" />
          <StatCard label="Driving Time" value={routeData.drivingTime || '0h'} icon="🚚" />
          <StatCard label="Rest Time" value={routeData.restTime || '0h'} icon="🛌" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <MapPin className="w-7 h-7 text-indigo-600" />
          Interactive Route Map
        </h2>
        <MapView 
          stops={routeData.stops}
          tripData={tripData}
          className="h-96 rounded-2xl border-2 border-gray-200 shadow-inner"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Clock className="w-7 h-7 text-indigo-600" />
          Trip Timeline
        </h2>
        <div className="space-y-3">
          {routeData.stops && routeData.stops.map((stop, index) => (
            <StopCard key={index} stop={stop} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-xl p-5 border-2 border-indigo-200 shadow-md hover:shadow-lg transition-all">
      <p className="text-sm text-gray-600 mb-2 font-semibold flex items-center gap-2">
        <span>{icon}</span>
        {label}
      </p>
      <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{value}</p>
    </div>
  );
}

function StopCard({ stop, index }) {
  const getStopIcon = () => {
    switch (stop.type) {
      case 'start': return '🚦';
      case 'pickup': return '📦';
      case 'fuel': return '⛽';
      case 'rest': return '🛌';
      case 'dropoff': return '📍';
      default: return '•';
    }
  };

  const getStopColor = () => {
    switch (stop.type) {
      case 'start': return 'from-green-100 to-emerald-100 border-green-300';
      case 'pickup': return 'from-blue-100 to-cyan-100 border-blue-300';
      case 'fuel': return 'from-yellow-100 to-amber-100 border-yellow-300';
      case 'rest': return 'from-purple-100 to-violet-100 border-purple-300';
      case 'dropoff': return 'from-red-100 to-rose-100 border-red-300';
      default: return 'from-gray-100 to-slate-100 border-gray-300';
    }
  };

  return (
    <div className={`flex items-start gap-4 p-5 rounded-xl border-2 bg-gradient-to-r ${getStopColor()} shadow-md hover:shadow-lg transition-all`}>
      <div className="text-3xl">{getStopIcon()}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">{stop.title}</h3>
          <span className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-lg">{stop.time}</span>
        </div>
        <p className="text-sm text-gray-700 mt-2 font-medium">{stop.location}</p>
        {stop.duration && (
          <p className="text-sm text-gray-600 mt-1">Duration: <span className="font-semibold">{stop.duration}</span></p>
        )}
        {stop.notes && (
          <p className="text-xs text-gray-500 mt-2 italic bg-white bg-opacity-50 p-2 rounded">{stop.notes}</p>
        )}
      </div>
    </div>
  );
}

function GeneratedLogsDisplay({ dailyLogs, onDownload }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Generated ELD Logs</h2>
          <div className="flex gap-3">
            <button 
              onClick={onDownload}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg text-sm font-bold flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg text-sm font-bold flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print Logs
            </button>
          </div>
        </div>
        
        {dailyLogs.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No logs generated yet</p>
            <p className="text-sm text-gray-500 mt-2">Complete your live logging and finalize to generate logs</p>
          </div>
        ) : (
          <div className="space-y-8">
            {dailyLogs.map((log, index) => (
              <TraditionalLogSheet 
                key={index} 
                log={log} 
                dayNumber={dailyLogs.length - index}
                // ✅ Remove the tripData prop - the log already contains tripData
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function TraditionalLogSheet({ log, dayNumber }) {
  const actualTripData = log.tripData || {};
  
  const calculateTotalMilesFromLog = (log) => {
    if (!log.segments) return 0;
    const drivingHours = log.segments
      .filter(seg => seg && seg.status === 2)
      .reduce((sum, seg) => sum + (seg.duration || 0), 0);
    return Math.round(drivingHours * 55);
  };

  const totalMiles = log.totalMiles || calculateTotalMilesFromLog(log) || 0;

  return (
    <div className="bg-white border-4 border-gray-900 rounded-lg p-8 font-serif shadow-2xl">
      <div className="text-center border-b-4 border-gray-900 pb-4 mb-6">
        <h1 className="text-3xl font-bold uppercase">Driver's Daily Log</h1>
        <div className="grid grid-cols-3 gap-6 mt-3 text-sm">
          <div className="font-semibold">
            <span>Date:</span> <span className="ml-2">{log.date || new Date().toLocaleDateString()}</span>
          </div>
          <div className="font-semibold">
            <span>Day:</span> <span className="ml-2">{dayNumber}</span>
          </div>
          <div className="font-semibold">
            <span>Total Miles:</span> <span className="ml-2">{totalMiles}</span>
          </div>
        </div>
      </div>

      {/* ✅ IMPROVED: Show ALL carrier and driver information */}
      <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
        <div>
          <div className="font-bold mb-1">Driver Name:</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold text-lg">
            {actualTripData.driverName || 'Not specified'}
          </div>
          
          <div className="font-bold mb-1 mt-4">Name of Carrier:</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold">
            {actualTripData.carrierName || 'Not specified'}
          </div>
          
          <div className="text-xs mt-2 font-semibold">Main Office Address</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold">
            {actualTripData.carrierAddress || 'Not specified'}
          </div>
        </div>
        
        <div>
          <div className="font-bold mb-1">Home Terminal Address:</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold">
            {actualTripData.homeTerminal || 'Not specified'}
          </div>
          
          <div className="font-bold mb-1 mt-4">Vehicle/Truck No.:</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold">
            {actualTripData.vehicleNumber || 'Not specified'}
          </div>
          
          <div className="font-bold mb-1 mt-4">Trailer No.:</div>
          <div className="border-b-2 border-gray-900 py-2 font-semibold">
            {actualTripData.trailerNumber || 'Not specified'}
          </div>
        </div>
      </div>

      {/* Trip Information Section */}
      <div className="grid grid-cols-3 gap-6 mb-6 text-sm border-2 border-gray-300 p-4 rounded-lg">
        <div>
          <div className="font-bold mb-1">Start Location:</div>
          <div className="border-b border-gray-300 py-1 font-semibold">
            {actualTripData.currentLocation || 'Not specified'}
          </div>
        </div>
        <div>
          <div className="font-bold mb-1">Pickup Location:</div>
          <div className="border-b border-gray-300 py-1 font-semibold">
            {actualTripData.pickupLocation || 'Not specified'}
          </div>
        </div>
        <div>
          <div className="font-bold mb-1">Destination:</div>
          <div className="border-b border-gray-300 py-1 font-semibold">
            {actualTripData.dropoffLocation || 'Not specified'}
          </div>
        </div>
      </div>

      {/* Rest of your component remains the same... */}
      <div className="mb-6">
        <div className="text-center font-bold text-lg mb-3 uppercase">24 Hour Grid</div>
        <ELDLogGrid segments={log.segments} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
        <div className="text-center border-2 border-gray-900 rounded p-3">
          <div className="font-bold border-b-2 border-gray-900 py-2">1. Off Duty</div>
          <div className="py-3 text-xl font-bold">{(log.summary?.offDuty || 0).toFixed(1)}h</div>
        </div>
        <div className="text-center border-2 border-gray-900 rounded p-3">
          <div className="font-bold border-b-2 border-gray-900 py-2">2. Sleeper Berth</div>
          <div className="py-3 text-xl font-bold">{(log.summary?.sleeper || 0).toFixed(1)}h</div>
        </div>
        <div className="text-center border-2 border-gray-900 rounded p-3">
          <div className="font-bold border-b-2 border-gray-900 py-2">3. Driving</div>
          <div className="py-3 text-xl font-bold">{(log.summary?.driving || 0).toFixed(1)}h</div>
        </div>
        
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">4. On Duty</div>
          <div className="py-2">{(log.summary?.onDuty || 0).toFixed(1)}h</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="font-semibold border-b border-gray-800 py-1">Remarks</div>
        <div className="py-2 min-h-12">{log.remarks || 'No remarks'}</div>
      </div>

      <div className="border-t-2 border-gray-800 pt-4 text-sm">
        <div className="text-center">
          <div className="font-semibold">Driver Signature</div>
          <div className="border-b border-gray-800 py-4 mt-2"></div>
          <div className="mt-1 font-bold text-lg">{actualTripData.driverName || 'Driver'}</div>
        </div>
      </div>

     
    </div>
  );
}

function ELDLogGrid({ segments }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const statusLabels = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty'];
  
  // Add safety check for segments
  const safeSegments = segments || [];
  
  return (
    <div className="relative border-2 border-gray-900">
      {/* Hour headers */}
      <div className="flex border-b-2 border-gray-900">
        {hours.map(hour => (
          <div 
            key={hour} 
            className="flex-1 text-center text-xs py-2 border-r border-gray-900 font-semibold last:border-r-0"
          >
            {hour.toString().padStart(2, '0')}
          </div>
        ))}
      </div>

      {/* Status rows */}
      <div className="relative" style={{ minHeight: '200px' }}>
        {statusLabels.map((label, statusIndex) => (
          <div 
            key={label} 
            className="flex border-b border-gray-900 relative h-12 last:border-b-2"
          >
            {/* Status label */}
            <div className="absolute -left-32 w-28 text-xs font-semibold flex items-center justify-end pr-3 h-full">
              {label}
            </div>
            
            {/* Hour cells with grid lines */}
            {hours.map(hour => (
              <div 
                key={hour} 
                className="flex-1 border-r border-gray-300 relative last:border-r-0"
              >
                {/* Draw segments that overlap this hour */}
                {safeSegments
                  .filter(seg => 
                    seg && 
                    seg.status === statusIndex && 
                    typeof seg.start === 'number' &&
                    typeof seg.end === 'number' &&
                    seg.start < hour + 1 && 
                    seg.end > hour
                  )
                  .map((seg, i) => {
                    // Calculate position within this hour cell
                    const cellStart = Math.max(seg.start || 0, hour);
                    const cellEnd = Math.min(seg.end || hour + 1, hour + 1);
                    
                    const startPercent = ((cellStart - hour) * 100);
                    const widthPercent = ((cellEnd - cellStart) * 100);
                    
                    // Calculate duration safely
                    const duration = seg.duration || (seg.end - seg.start) || 0;
                    
                    return (
                      <div
                        key={`${statusIndex}-${hour}-${i}`}
                        className="absolute top-1 bottom-1 bg-gray-900"
                        style={{
                          left: `${startPercent}%`,
                          width: `${widthPercent}%`,
                          minWidth: '2px'
                        }}
                        title={`${label}: ${duration.toFixed(2)}h`}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
