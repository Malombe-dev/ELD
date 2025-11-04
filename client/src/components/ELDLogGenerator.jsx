import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Truck, Clock, FileText, AlertCircle, Download, Play, Coffee, Moon, Save, Printer } from 'lucide-react';
import MapView from './MapView';
// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';


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
      location: location || getStatusDescription(newStatus),
      type: 'manual',
      previousStatus: previousStatus,
      duration: durationHours
    };
    
    setStatusHistory(prev => [...prev, newEntry]);
    setCurrentStatus(newStatus);
    setLastStatusChangeTime(changeTime);
    updateLogSegments(newStatus, changeTime);
    
    if (location) {
      setCurrentLocation(location);
    }
  };

  const updateLogSegments = (newStatus, changeTime) => {
    const statusMap = { 'off': 0, 'sleeper': 1, 'driving': 2, 'on': 3 };
    const currentHour = changeTime.getHours() + (changeTime.getMinutes() / 60);
    
    setCurrentDayLog(prev => {
      const lastSegment = prev.segments[prev.segments.length - 1];
      const newSegments = [...prev.segments];
      
      if (lastSegment) {
        newSegments[newSegments.length - 1] = {
          ...lastSegment,
          end: currentHour
        };
      }
      
      newSegments.push({
        status: statusMap[newStatus],
        start: currentHour,
        end: 24
      });
      
      const summary = calculateTotalsFromSegments(newSegments);
      
      return {
        ...prev,
        segments: newSegments,
        summary
      };
    });
  };

  const calculateTotalsFromSegments = (segments) => {
    const totals = { offDuty: 0, sleeper: 0, driving: 0, onDuty: 0 };
    const statusKeys = ['offDuty', 'sleeper', 'driving', 'onDuty'];
    
    segments.forEach(segment => {
      if (segment.end !== 24) {
        const duration = segment.end - segment.start;
        if (duration > 0) {
          totals[statusKeys[segment.status]] += duration;
        }
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
          carrier_name: tripData.carrierName || 'Carrier'
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
      const finalHour = finalTime.getHours() + (finalTime.getMinutes() / 60);
      
      const finalSegments = currentDayLog.segments.map((segment, index) => {
        if (index === currentDayLog.segments.length - 1) {
          return { ...segment, end: finalHour };
        }
        return segment;
      });

      const finalizedLog = {
        ...currentDayLog,
        segments: finalSegments,
        tripData: { ...tripData },
        statusHistory: [...statusHistory],
        finalizedAt: new Date().toISOString(),
        totalMiles: await calculateTotalMilesFromAPI(),
        remarks: generateRemarksFromActivity(),
        carrier: tripData.carrierName || 'Transport Co.',
        driver: tripData.driverName || 'Driver'
      };

      const saveResponse = await fetch(`${API_BASE_URL}/api/save-log/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalizedLog)
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save log to server');
      }

      const savedLog = await saveResponse.json();
      
      setDailyLogs(prev => [...prev, savedLog]);
      resetForNewDay();
      
      alert('Daily log finalized and saved successfully!');
      setActiveTab('logs');
    } catch (error) {
      console.error('Error saving log:', error);
      alert(`Error saving log: ${error.message}. Please try again.`);
    }
  };

  const calculateTotalMilesFromAPI = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/today-mileage/`);
      if (response.ok) {
        const data = await response.json();
        return data.mileage || 0;
      }
    } catch (error) {
      console.error('Error fetching mileage:', error);
    }
    
    const drivingHours = currentDayLog.summary.driving;
    return Math.round(drivingHours * 55);
  };

  const generateRemarksFromActivity = () => {
    const drivingTime = currentDayLog.summary.driving;
    const locations = statusHistory
      .filter(entry => entry.location && entry.location !== getStatusDescription(entry.status))
      .map(entry => entry.location)
      .filter((location, index, self) => self.indexOf(location) === index);
    
    const locationStr = locations.length > 0 ? locations.join(', ') : 'Various locations';
    const pickupStr = tripData.pickupLocation ? ` Pickup at ${tripData.pickupLocation}.` : '';
    
    return `Drove ${drivingTime.toFixed(1)}h. Locations: ${locationStr}.${pickupStr}`;
  };

  const resetForNewDay = () => {
    const newDate = new Date();
    
    setCurrentDayLog({
      date: newDate.toLocaleDateString(),
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
  };

  const downloadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver-logs/`);
      
      if (response.ok) {
        const logs = await response.json();
        const logsData = JSON.stringify(logs, null, 2);
        const blob = new Blob([logsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eld-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Failed to fetch logs from server');
      }
    } catch (error) {
      console.error('Error downloading logs:', error);
      
      if (dailyLogs.length > 0) {
        const logsData = JSON.stringify(dailyLogs, null, 2);
        const blob = new Blob([logsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eld-logs-local-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('No logs available to download');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ELD Log Generator</h1>
                <p className="text-sm text-gray-600">Hours of Service Compliance Tool</p>
              </div>
            </div>
            
            {currentStatus && (
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentStatus === 'driving' ? 'bg-red-100 text-red-800' :
                  currentStatus === 'on' ? 'bg-yellow-100 text-yellow-800' :
                  currentStatus === 'sleeper' ? 'bg-purple-100 text-purple-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {getStatusDisplay(currentStatus)}
                </div>
                <div className="text-sm text-gray-600">
                  Since: {lastStatusChangeTime.toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-1 flex gap-1">
          <TabButton 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')}
            icon={<MapPin className="w-4 h-4" />}
            label="Trip Planning"
          />
          <TabButton 
            active={activeTab === 'route'} 
            onClick={() => setActiveTab('route')}
            icon={<Clock className="w-4 h-4" />}
            label="Route & Stops"
            disabled={!routeData}
          />
          <TabButton 
            active={activeTab === 'realtime'} 
            onClick={() => setActiveTab('realtime')}
            icon={<Play className="w-4 h-4" />}
            label="Live Logging"
          />
          <TabButton 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')}
            icon={<FileText className="w-4 h-4" />}
            label="Generated Logs"
            disabled={dailyLogs.length === 0}
          />
        </div>
      </div>

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
        
        {activeTab === 'realtime' && (
          <RealTimeLogging
            currentStatus={currentStatus}
            currentLocation={currentLocation}
            statusHistory={statusHistory}
            currentLog={currentDayLog}
            tripData={tripData}
            onStatusChange={changeStatus}
            onLocationChange={setCurrentLocation}
            onFinalizeLog={finalizeDailyLog}
            lastStatusChangeTime={lastStatusChangeTime}
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

// Helper Functions
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
  return `${hours}h ${minutes}m`;
}

// Components
function TabButton({ active, onClick, icon, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${active ? 'bg-indigo-600 text-white shadow-sm' : disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

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
          className={`block w-full py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${icon ? 'pl-10 pr-3' : 'px-3'}`}
        />
      </div>
    </div>
  );
}

function TripInputForm({ tripData, handleInputChange, calculateRoute, loading, error }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Enter Trip Details</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InputField label="Driver Name" name="driverName" value={tripData.driverName} onChange={handleInputChange} placeholder="e.g., John Doe" />
        <InputField label="Carrier Name" name="carrierName" value={tripData.carrierName} onChange={handleInputChange} placeholder="e.g., Transport Co." />
        <InputField label="Carrier Address" name="carrierAddress" value={tripData.carrierAddress} onChange={handleInputChange} placeholder="e.g., 123 Main St" />
        <InputField label="Home Terminal" name="homeTerminal" value={tripData.homeTerminal} onChange={handleInputChange} placeholder="e.g., Terminal Address" />
        <InputField label="Vehicle Number" name="vehicleNumber" value={tripData.vehicleNumber} onChange={handleInputChange} placeholder="e.g., V-1234" />
        <InputField label="Trailer Number" name="trailerNumber" value={tripData.trailerNumber} onChange={handleInputChange} placeholder="e.g., T-5678" />
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="Current Location" name="currentLocation" value={tripData.currentLocation} onChange={handleInputChange} placeholder="e.g., New York, NY" icon={<MapPin className="w-5 h-5 text-gray-400" />} />
          <InputField label="Pickup Location" name="pickupLocation" value={tripData.pickupLocation} onChange={handleInputChange} placeholder="e.g., Chicago, IL" icon={<MapPin className="w-5 h-5 text-gray-400" />} />
          <InputField label="Drop-off Location" name="dropoffLocation" value={tripData.dropoffLocation} onChange={handleInputChange} placeholder="e.g., Los Angeles, CA" icon={<MapPin className="w-5 h-5 text-gray-400" />} />
          <InputField label="Current Cycle Hours Used" name="currentCycleHours" type="number" value={tripData.currentCycleHours} onChange={handleInputChange} placeholder="0-70" min="0" max="70" step="0.5" icon={<Clock className="w-5 h-5 text-gray-400" />} />
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Enter your trip details above</li>
          <li>• Click "Calculate Route" to plan your trip</li>
          <li>• Go to "Live Logging" to track your actual hours</li>
          <li>• Use status buttons throughout your shift</li>
          <li>• Finalize log at end of day to generate official ELD logs</li>
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
            Calculate Route
          </>
        )}
      </button>
    </div>
  );
}

function RealTimeLogging({ currentStatus, currentLocation, statusHistory, currentLog, tripData, onStatusChange, onLocationChange, onFinalizeLog, lastStatusChangeTime }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Live Logging - {currentLog.date}</h2>
          <button
            onClick={onFinalizeLog}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Finalize Today's Log
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Change Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatusButton
                status="off"
                current={currentStatus}
                onClick={() => onStatusChange('off', currentLocation)}
                icon={<Coffee className="w-5 h-5" />}
                label="Off Duty"
                color="bg-green-500 hover:bg-green-600"
              />
              <StatusButton
                status="sleeper"
                current={currentStatus}
                onClick={() => onStatusChange('sleeper', currentLocation)}
                icon={<Moon className="w-5 h-5" />}
                label="Sleeper"
                color="bg-purple-500 hover:bg-purple-600"
              />
              <StatusButton
                status="on"
                current={currentStatus}
                onClick={() => onStatusChange('on', currentLocation)}
                icon={<FileText className="w-5 h-5" />}
                label="On Duty"
                color="bg-yellow-500 hover:bg-yellow-600"
              />
              <StatusButton
                status="driving"
                current={currentStatus}
                onClick={() => onStatusChange('driving', currentLocation)}
                icon={<Play className="w-5 h-5" />}
                label="Driving"
                color="bg-red-500 hover:bg-red-600"
              />
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => onLocationChange(e.target.value)}
                  placeholder="Enter your current location..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={() => onStatusChange(currentStatus, currentLocation)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Update
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <div className="font-semibold">Current Status: {getStatusDisplay(currentStatus)}</div>
                <div>Started at: {lastStatusChangeTime.toLocaleTimeString()}</div>
                <div>Duration: {calculateCurrentDuration(lastStatusChangeTime)}</div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Today's Totals</h3>
            <div className="grid grid-cols-2 gap-3">
              <TotalCard label="Off Duty" value={currentLog.summary.offDuty} color="bg-green-100" />
              <TotalCard label="Sleeper" value={currentLog.summary.sleeper} color="bg-purple-100" />
              <TotalCard label="Driving" value={currentLog.summary.driving} color="bg-red-100" />
              <TotalCard label="On Duty" value={currentLog.summary.onDuty} color="bg-yellow-100" />
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Current Trip</h4>
              <div className="text-sm text-blue-800">
                <div>From: {tripData.currentLocation || 'Not specified'}</div>
                <div>To: {tripData.dropoffLocation || 'Not specified'}</div>
                <div>Pickup: {tripData.pickupLocation || 'Not specified'}</div>
              </div>
            </div>

            <div className={`mt-4 p-3 rounded-lg border ${
              currentLog.summary.driving < 11 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className={`flex items-center gap-2 text-sm ${
                currentLog.summary.driving < 11 ? 'text-green-800' : 'text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  currentLog.summary.driving < 11 ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-semibold">
                  {currentLog.summary.driving < 11 ? 'HOS Compliant' : 'HOS Violation'}
                </span>
                <span>• Driving: {currentLog.summary.driving}h / 11h max</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Status History</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {statusHistory.slice().reverse().map((entry, index) => (
              <div key={index} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-b-0">
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {entry.time.toLocaleTimeString()}
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  entry.status === 'driving' ? 'bg-red-100 text-red-800' :
                  entry.status === 'on' ? 'bg-yellow-100 text-yellow-800' :
                  entry.status === 'sleeper' ? 'bg-purple-100 text-purple-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {getStatusDisplay(entry.status)}
                </span>
                <span className="text-gray-600 flex-1 text-sm">{entry.location}</span>
                {entry.duration > 0 && (
                  <span className="text-xs text-gray-500">{entry.duration.toFixed(1)}h</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Log Preview</h2>
          <ELDLogGrid segments={currentLog.segments} />
        </div>
      </div>
    </div>
  );
}

function StatusButton({ status, current, onClick, icon, label, color }) {
  const isActive = current === status;
  
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg text-white font-medium transition-all flex flex-col items-center gap-2 ${
        isActive ? 'ring-4 ring-opacity-50 ring-current' : ''
      } ${color}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TotalCard({ label, value, color }) {
  return (
    <div className={`${color} p-3 rounded-lg text-center`}>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value.toFixed(1)}h</div>
    </div>
  );
}

function RouteDisplay({ routeData, tripData }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Summary</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Distance" value={`${routeData.totalDistance || '0'} mi`} />
          <StatCard label="Total Duration" value={routeData.totalDuration || '0h'} />
          <StatCard label="Driving Time" value={routeData.drivingTime || '0h'} />
          <StatCard label="Rest Time" value={routeData.restTime || '0h'} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Map</h2>
        <MapView 
          stops={routeData.stops}
          tripData={tripData}
          className="h-96 rounded-lg border-2 border-gray-200"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Trip Timeline</h2>
        <div className="space-y-3">
          {routeData.stops && routeData.stops.map((stop, index) => (
            <StopCard key={index} stop={stop} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-indigo-900">{value}</p>
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

function GeneratedLogsDisplay({ dailyLogs, onDownload }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Generated ELD Logs</h2>
          <div className="flex gap-2">
            <button 
              onClick={onDownload}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download All Logs
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Logs
            </button>
          </div>
        </div>
        
        <div className="space-y-8">
          {dailyLogs.map((log, index) => (
            <TraditionalLogSheet 
              key={index} 
              log={log} 
              dayNumber={dailyLogs.length - index}
              tripData={log.tripData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TraditionalLogSheet({ log, dayNumber, tripData }) {
  const actualTripData = log.tripData || tripData || {};
  
  return (
    <div className="bg-white border-2 border-gray-800 rounded-none p-6 font-serif">
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

      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <div className="font-semibold">Name of Carrier:</div>
          <div className="border-b border-gray-800 py-1">{actualTripData.carrierName || 'Transport Co.'}</div>
          <div className="text-xs mt-1">Main Office Address</div>
          <div className="border-b border-gray-800 py-1">{actualTripData.carrierAddress || '123 Main St, Anytown, USA'}</div>
        </div>
        <div>
          <div className="font-semibold">Home Terminal Address:</div>
          <div className="border-b border-gray-800 py-1">{actualTripData.homeTerminal || '456 Terminal Rd, Hometown, USA'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <div>
          <div className="font-semibold">Vehicle/Truck No.:</div>
          <div className="border-b border-gray-800 py-1">{actualTripData.vehicleNumber || 'V-1234'}</div>
        </div>
        <div>
          <div className="font-semibold">Trailer No.:</div>
          <div className="border-b border-gray-800 py-1">{actualTripData.trailerNumber || 'T-5678'}</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-center font-semibold mb-2">24 HOUR GRID</div>
        <ELDLogGrid segments={log.segments} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">1. Off Duty</div>
          <div className="py-2">{log.summary.offDuty.toFixed(1)}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">2. Sleeper Berth</div>
          <div className="py-2">{log.summary.sleeper.toFixed(1)}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">3. Driving</div>
          <div className="py-2">{log.summary.driving.toFixed(1)}h</div>
        </div>
        <div className="text-center">
          <div className="font-semibold border-b border-gray-800 py-1">4. On Duty</div>
          <div className="py-2">{log.summary.onDuty.toFixed(1)}h</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="font-semibold border-b border-gray-800 py-1">Remarks</div>
        <div className="py-2 min-h-12">{log.remarks}</div>
      </div>

      <div className="mb-4">
        <div className="font-semibold border-b border-gray-800 py-1">Shipping Documents:</div>
        <div className="py-2 text-sm">
          <div>Driver retains this log for 8 days</div>
          <div className="mt-1">Origin: {actualTripData.currentLocation || 'Not specified'}</div>
          <div>Destination: {actualTripData.dropoffLocation || 'Not specified'}</div>
        </div>
      </div>

      <div className="border-t-2 border-gray-800 pt-4 text-sm">
        <div className="text-center">
          <div className="font-semibold">Driver Signature</div>
          <div className="border-b border-gray-800 py-4 mt-2"></div>
          <div className="mt-1">{actualTripData.driverName || 'John Doe'}</div>
        </div>
      </div>
    </div>
  );
}

function ELDLogGrid({ segments }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return (
    <div className="relative border-2 border-gray-800">
      <div className="flex border-b border-gray-800">
        {hours.map(hour => (
          <div key={hour} className="flex-1 text-center text-xs py-1 border-r border-gray-800 last:border-r-0">
            {hour}
          </div>
        ))}
      </div>

      <div className="relative">
        {['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty'].map((status, statusIndex) => (
          <div key={status} className="flex border-b border-gray-800 relative h-8 last:border-b-0">
            <div className="absolute -left-32 w-28 text-xs font-medium flex items-center justify-end pr-2">
              {status}
            </div>
            
            {hours.map(hour => (
              <div key={hour} className="flex-1 border-r border-gray-800 relative last:border-r-0">
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