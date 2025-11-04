import React, { useState } from 'react';
import { MapPin, Truck, Clock, FileText, AlertCircle, Download } from 'lucide-react';
import MapView from './MapView';

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
    currentCycleHours: 0
  });
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTripData(prev => ({
      ...prev,
      [name]: name === 'currentCycleHours' ? parseFloat(value) || 0 : value
    }));
  };

  const calculateRoute = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/calculate-route/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData)
      });

      if (!response.ok) {
        throw new Error('Failed to calculate route');
      }

      const data = await response.json();
      setRouteData(data);
      setActiveTab('route');
    } catch (err) {
      setError(err.message);
      // For demo purposes, use mock data
      const mockData = generateMockRouteData(tripData);
      setRouteData(mockData);
      setActiveTab('route');
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = () => {
    const logsData = JSON.stringify(routeData.logs, null, 2);
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eld-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ELD Log Generator</h1>
              <p className="text-sm text-gray-600">Hours of Service Compliance Tool</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
          <TabButton 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')}
            icon={<MapPin className="w-4 h-4" />}
            label="Trip Input"
          />
          <TabButton 
            active={activeTab === 'route'} 
            onClick={() => setActiveTab('route')}
            icon={<Clock className="w-4 h-4" />}
            label="Route & Stops"
            disabled={!routeData}
          />
          <TabButton 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')}
            icon={<FileText className="w-4 h-4" />}
            label="ELD Logs"
            disabled={!routeData}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        
        {activeTab === 'logs' && routeData && (
          <ELDLogsDisplay 
            routeData={routeData} 
            tripData={tripData}
            onDownload={downloadLogs}
          />
        )}
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all
        ${active 
          ? 'bg-indigo-600 text-white shadow-sm' 
          : disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Trip Input Form Component
function TripInputForm({ tripData, handleInputChange, calculateRoute, loading, error }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Enter Trip Details</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">API Connection Issue</p>
            <p className="text-sm text-yellow-700 mt-1">Using demo data for preview</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InputField
          label="Driver Name"
          name="driverName"
          value={tripData.driverName}
          onChange={handleInputChange}
          placeholder="e.g., John Doe"
        />
        
        <InputField
          label="Carrier Name"
          name="carrierName"
          value={tripData.carrierName}
          onChange={handleInputChange}
          placeholder="e.g., Transport Co."
        />
        
        <InputField
          label="Carrier Address"
          name="carrierAddress"
          value={tripData.carrierAddress}
          onChange={handleInputChange}
          placeholder="e.g., 123 Main St, City, State"
        />
        
        <InputField
          label="Home Terminal"
          name="homeTerminal"
          value={tripData.homeTerminal}
          onChange={handleInputChange}
          placeholder="e.g., Home Terminal Address"
        />
        
        <InputField
          label="Vehicle Number"
          name="vehicleNumber"
          value={tripData.vehicleNumber}
          onChange={handleInputChange}
          placeholder="e.g., V-1234"
        />
        
        <InputField
          label="Trailer Number"
          name="trailerNumber"
          value={tripData.trailerNumber}
          onChange={handleInputChange}
          placeholder="e.g., T-5678"
        />
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Current Location"
            name="currentLocation"
            value={tripData.currentLocation}
            onChange={handleInputChange}
            placeholder="e.g., New York, NY"
            icon={<MapPin className="w-5 h-5 text-gray-400" />}
          />
          
          <InputField
            label="Pickup Location"
            name="pickupLocation"
            value={tripData.pickupLocation}
            onChange={handleInputChange}
            placeholder="e.g., Chicago, IL"
            icon={<MapPin className="w-5 h-5 text-gray-400" />}
          />
          
          <InputField
            label="Drop-off Location"
            name="dropoffLocation"
            value={tripData.dropoffLocation}
            onChange={handleInputChange}
            placeholder="e.g., Los Angeles, CA"
            icon={<MapPin className="w-5 h-5 text-gray-400" />}
          />
          
          <InputField
            label="Current Cycle Hours Used"
            name="currentCycleHours"
            type="number"
            value={tripData.currentCycleHours}
            onChange={handleInputChange}
            placeholder="0-70"
            min="0"
            max="70"
            step="0.5"
            icon={<Clock className="w-5 h-5 text-gray-400" />}
          />
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Assumptions:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Property-carrying driver (70hrs/8days limit)</li>
          <li>• No adverse driving conditions</li>
          <li>• Fueling stop every 1,000 miles</li>
          <li>• 1 hour for pickup and drop-off</li>
        </ul>
      </div>

      <button
        onClick={calculateRoute}
        disabled={loading || !tripData.currentLocation || !tripData.pickupLocation || !tripData.dropoffLocation}
        className="mt-6 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Calculating Route...
          </>
        ) : (
          <>
            <Clock className="w-5 h-5" />
            Calculate Route & Generate Logs
          </>
        )}
      </button>
    </div>
  );
}

// Input Field Component
function InputField({ label, icon, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
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
          className={`block w-full py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${
            icon ? 'pl-10 pr-3' : 'px-3'
          }`}
        />
      </div>
    </div>
  );
}

// Route Display Component
function RouteDisplay({ routeData, tripData }) {
  return (
    <div className="space-y-6">
      {/* Route Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Distance" value={`${routeData.totalDistance} mi`} />
          <StatCard label="Total Duration" value={routeData.totalDuration} />
          <StatCard label="Driving Time" value={routeData.drivingTime} />
          <StatCard label="Rest Time" value={routeData.restTime} />
        </div>
      </div>

      {/* Map Integration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Map</h2>
        <MapView 
          stops={routeData.stops}
          tripData={tripData}
          className="h-96 rounded-lg border-2 border-gray-200"
        />
      </div>

      {/* Stops Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Trip Timeline</h2>
        <div className="space-y-3">
          {routeData.stops.map((stop, index) => (
            <StopCard key={index} stop={stop} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-indigo-900">{value}</p>
    </div>
  );
}

// Stop Card Component
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
      case 'start': return 'bg-green-100 border-green-300';
      case 'pickup': return 'bg-blue-100 border-blue-300';
      case 'fuel': return 'bg-yellow-100 border-yellow-300';
      case 'rest': return 'bg-purple-100 border-purple-300';
      case 'dropoff': return 'bg-red-100 border-red-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border-2 ${getStopColor()}`}>
      <div className="text-2xl">{getStopIcon()}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{stop.title}</h3>
          <span className="text-sm text-gray-600">{stop.time}</span>
        </div>
        <p className="text-sm text-gray-700 mt-1">{stop.location}</p>
        {stop.duration && (
          <p className="text-sm text-gray-600 mt-1">Duration: {stop.duration}</p>
        )}
        {stop.notes && (
          <p className="text-xs text-gray-500 mt-2 italic">{stop.notes}</p>
        )}
      </div>
    </div>
  );
}

// ELD Logs Display Component
function ELDLogsDisplay({ routeData, tripData, onDownload }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Generated ELD Logs</h2>
          <button 
            onClick={onDownload}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download All Logs
          </button>
        </div>
        
        <div className="space-y-8">
          {routeData.logs.map((log, index) => (
            <TraditionalLogSheet 
              key={index} 
              log={log} 
              dayNumber={index + 1}
              tripData={tripData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Traditional Paper Log Sheet Component
function TraditionalLogSheet({ log, dayNumber, tripData }) {
  return (
    <div className="bg-white border-2 border-gray-800 rounded-none p-6 font-serif">
      {/* Header Section */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <h1 className="text-2xl font-bold uppercase">Driver's Daily Log</h1>
        <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
          <div>
            <span className="font-semibold">Date:</span> {log.date}
          </div>
          <div>
            <span className="font-semibold">Day:</span> {dayNumber}
          </div>
          <div>
            <span className="font-semibold">Total Miles Today:</span> {log.totalMiles}
          </div>
        </div>
      </div>

      {/* Carrier Information */}
      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <div className="font-semibold">Name of Carrier:</div>
          <div className="border-b border-gray-800 py-1">{tripData.carrierName || 'Transport Co.'}</div>
          <div className="text-xs mt-1">Main Office Address</div>
          <div className="border-b border-gray-800 py-1">{tripData.carrierAddress || '123 Main St, Anytown, USA'}</div>
        </div>
        <div>
          <div className="font-semibold">Home Terminal Address:</div>
          <div className="border-b border-gray-800 py-1">{tripData.homeTerminal || '456 Terminal Rd, Hometown, USA'}</div>
        </div>
      </div>

      {/* Vehicle Information */}
      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <div className="font-semibold">Vehicle/Truck No.:</div>
          <div className="border-b border-gray-800 py-1">{tripData.vehicleNumber || 'V-1234'}</div>
        </div>
        <div>
          <div className="font-semibold">Trailer No.:</div>
          <div className="border-b border-gray-800 py-1">{tripData.trailerNumber || 'T-5678'}</div>
        </div>
      </div>

      {/* 24-Hour Grid */}
      <div className="mb-6">
        <div className="text-center font-semibold mb-2">24 HOUR GRID</div>
        <ELDLogGrid segments={log.segments} />
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">1. Off Duty</div>
          <div className="py-2">{log.summary.offDuty}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">2. Sleeper Berth</div>
          <div className="py-2">{log.summary.sleeper}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">3. Driving</div>
          <div className="py-2">{log.summary.driving}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">4. On Duty</div>
          <div className="py-2">{log.summary.onDuty}h</div>
        </div>
      </div>

      {/* Remarks */}
      <div className="mb-4">
        <div className="font-semibold border-b border-gray-800 py-1">Remarks</div>
        <div className="py-2 min-h-12">{log.remarks}</div>
      </div>

      {/* Shipping Documents */}
      <div className="mb-4">
        <div className="font-semibold border-b border-gray-800 py-1">Shipping Documents:</div>
        <div className="py-2 text-sm">
          <div>Driver retains this log for 8 days</div>
          <div className="mt-1">Origin: {tripData.currentLocation || 'New York, NY'}</div>
          <div>Destination: {tripData.dropoffLocation || 'Los Angeles, CA'}</div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t-2 border-gray-800 pt-4 text-sm">
        <div className="text-center">
          <div className="font-semibold">Driver Signature</div>
          <div className="border-b border-gray-800 py-4 mt-2"></div>
          <div className="mt-1">{tripData.driverName || 'John Doe'}</div>
        </div>
      </div>
    </div>
  );
}

// ELD Log Grid Component (Updated for paper look)
function ELDLogGrid({ segments }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return (
    <div className="relative border-2 border-gray-800">
      {/* Hour markers */}
      <div className="flex border-b border-gray-800">
        {hours.map(hour => (
          <div key={hour} className="flex-1 text-center text-xs py-1 border-r border-gray-800">
            {hour}
          </div>
        ))}
      </div>

      {/* Status rows */}
      <div className="relative">
        {['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty'].map((status, statusIndex) => (
          <div key={status} className="flex border-b border-gray-800 relative h-8 last:border-b-0">
            <div className="absolute -left-32 w-28 text-xs font-medium flex items-center justify-end pr-2">
              {status}
            </div>
            
            {hours.map(hour => (
              <div key={hour} className="flex-1 border-r border-gray-800 relative last:border-r-0">
                {/* Draw segments */}
                {segments
                  .filter(seg => seg.status === statusIndex && seg.start <= hour && seg.end > hour)
                  .map((seg, i) => {
                    const startInHour = Math.max(0, seg.start - hour);
                    const endInHour = Math.min(1, seg.end - hour);
                    const width = (endInHour - startInHour) * 100;
                    const left = startInHour * 100;
                    
                    return (
                      <div
                        key={i}
                        className="absolute top-0.5 bottom-0.5 bg-gray-800"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`
                        }}
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

// Mock data generator for demo
function generateMockRouteData(tripData) {
  const totalDistance = 1850;
  const totalDrivingHours = 28;
  
  return {
    totalDistance: totalDistance,
    totalDuration: '3 days 2 hours',
    drivingTime: '28 hours',
    restTime: '46 hours',
    stops: [
      {
        type: 'start',
        title: 'Trip Start',
        location: tripData.currentLocation || 'New York, NY',
        time: 'Day 1, 6:00 AM',
        duration: null,
        notes: 'Begin trip with 10-hour rest completed'
      },
      {
        type: 'pickup',
        title: 'Pickup',
        location: tripData.pickupLocation || 'Chicago, IL',
        time: 'Day 1, 5:00 PM',
        duration: '1 hour',
        notes: 'Load cargo - 790 miles driven'
      },
      {
        type: 'rest',
        title: 'Required 10-Hour Rest',
        location: 'Chicago, IL',
        time: 'Day 1, 6:00 PM - Day 2, 4:00 AM',
        duration: '10 hours',
        notes: 'Sleeper berth - HOS compliance'
      },
      {
        type: 'fuel',
        title: 'Fuel Stop',
        location: 'Denver, CO',
        time: 'Day 2, 2:00 PM',
        duration: '30 minutes',
        notes: 'Fuel and 30-min break - 600 miles from Chicago'
      },
      {
        type: 'rest',
        title: 'Required 10-Hour Rest',
        location: 'Las Vegas, NV',
        time: 'Day 2, 8:00 PM - Day 3, 6:00 AM',
        duration: '10 hours',
        notes: 'Sleeper berth - 460 miles from Denver'
      },
      {
        type: 'dropoff',
        title: 'Drop-off',
        location: tripData.dropoffLocation || 'Los Angeles, CA',
        time: 'Day 3, 8:00 AM',
        duration: '1 hour',
        notes: 'Unload cargo - Trip complete'
      }
    ],
    logs: [
      {
        date: '04/09/2024',
        totalMiles: 790,
        segments: [
          { status: 0, start: 0, end: 6 },     // Off duty midnight-6am
          { status: 3, start: 6, end: 7 },     // On duty 6-7am (pre-trip)
          { status: 2, start: 7, end: 15 },    // Driving 7am-3pm
          { status: 3, start: 15, end: 17 },   // On duty 3-5pm (fuel)
          { status: 2, start: 17, end: 18 },   // Driving 5-6pm
          { status: 3, start: 18, end: 19 },   // On duty 6-7pm (pickup)
          { status: 1, start: 19, end: 24 }    // Sleeper 7pm-midnight
        ],
        summary: {
          offDuty: 6,
          sleeper: 5,
          driving: 9,
          onDuty: 4
        },
        remarks: `${tripData.currentLocation || 'New York, NY'} to ${tripData.pickupLocation || 'Chicago, IL'}. Pickup completed. Load: General merchandise.`
      },
      {
        date: '04/10/2024',
        totalMiles: 1060,
        segments: [
          { status: 1, start: 0, end: 4 },     // Sleeper midnight-4am
          { status: 3, start: 4, end: 5 },     // On duty 4-5am
          { status: 2, start: 5, end: 14 },    // Driving 5am-2pm
          { status: 3, start: 14, end: 14.5 }, // On duty 2-2:30pm (fuel)
          { status: 2, start: 14.5, end: 20 }, // Driving 2:30-8pm
          { status: 1, start: 20, end: 24 }    // Sleeper 8pm-midnight
        ],
        summary: {
          offDuty: 0,
          sleeper: 8,
          driving: 14.5,
          onDuty: 1.5
        },
        remarks: 'Chicago, IL to Las Vegas, NV. Fuel stop in Denver, CO. 30-min break completed.'
      },
      {
        date: '04/11/2024',
        totalMiles: 270,
        segments: [
          { status: 1, start: 0, end: 6 },     // Sleeper midnight-6am
          { status: 3, start: 6, end: 7 },     // On duty 6-7am
          { status: 2, start: 7, end: 8 },     // Driving 7-8am
          { status: 3, start: 8, end: 9 },     // On duty 8-9am (dropoff)
          { status: 0, start: 9, end: 24 }     // Off duty rest of day
        ],
        summary: {
          offDuty: 15,
          sleeper: 6,
          driving: 1,
          onDuty: 2
        },
        remarks: `Las Vegas, NV to ${tripData.dropoffLocation || 'Los Angeles, CA'}. Drop-off completed. Trip end. All cargo delivered.`
      }
    ]
  };
}