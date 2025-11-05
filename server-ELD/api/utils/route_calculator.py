from datetime import datetime, timedelta
from .geocoding import GeocodingService, OpenRouteService


class RouteCalculator:
    '''
    Calculate routes and generate waypoints
    '''
    
    def __init__(self):
        self.geocoding = GeocodingService()
        self.routing = OpenRouteService()
        self.FUEL_INTERVAL_MILES = 1000
        self.AVERAGE_SPEED_MPH = 55  # Average highway speed
    
    def calculate_route(self, current_location, pickup_location, dropoff_location):
        '''
        Calculate the complete route with all waypoints
        '''
        # Geocode all locations
        current_coords = self.geocoding.geocode(current_location)
        pickup_coords = self.geocoding.geocode(pickup_location)
        dropoff_coords = self.geocoding.geocode(dropoff_location)
        
        if not all([current_coords, pickup_coords, dropoff_coords]):
            raise Exception("Could not geocode one or more locations")
        
        # Calculate segments
        segment1 = self._calculate_segment(
            current_coords, pickup_coords, 
            current_location, pickup_location
        )
        
        segment2 = self._calculate_segment(
            pickup_coords, dropoff_coords,
            pickup_location, dropoff_location
        )
        
        total_distance = segment1['distance'] + segment2['distance']
        total_duration_hours = segment1['duration_hours'] + segment2['duration_hours']
        
        # Add pickup/dropoff time (1 hour each)
        total_duration_hours += 2
        
        return {
            'total_distance': round(total_distance, 1),
            'total_duration_hours': round(total_duration_hours, 1),
            'segment1': segment1,  # Current to Pickup
            'segment2': segment2,  # Pickup to Dropoff
            'current_coords': current_coords,
            'pickup_coords': pickup_coords,
            'dropoff_coords': dropoff_coords
        }
    
    def _calculate_segment(self, start_coords, end_coords, start_name, end_name):
        '''
        Calculate distance and duration for a route segment
        '''
        print(f"📏 Calculating segment: {start_name} to {end_name}")
        print(f"  Start coords: {start_coords}")
        print(f"  End coords: {end_coords}")
        
        # Make sure we're passing (lat, lon) tuples to calculate_distance
        distance = self.geocoding.calculate_distance(
            (start_coords['lat'], start_coords['lon']),  # (lat, lon)
            (end_coords['lat'], end_coords['lon'])       # (lat, lon)
        )
        
        duration_hours = distance / self.AVERAGE_SPEED_MPH
        fuel_stops_needed = int(distance / self.FUEL_INTERVAL_MILES)
        
        print(f"  Result: {distance:.1f} miles, {duration_hours:.1f} hours, {fuel_stops_needed} fuel stops")
        
        return {
            'start': start_name,
            'end': end_name,
            'start_coords': start_coords,
            'end_coords': end_coords,
            'distance': distance,
            'duration_hours': duration_hours,
            'fuel_stops_needed': fuel_stops_needed
        }

    def calculate_intermediate_point(self, start_coords, end_coords, fraction):
        '''
        Calculate coordinates at a fraction of the distance between start and end
        fraction: 0.0 to 1.0
        '''
        lat = start_coords['lat'] + (end_coords['lat'] - start_coords['lat']) * fraction
        lon = start_coords['lon'] + (end_coords['lon'] - start_coords['lon']) * fraction
        return {'lat': lat, 'lon': lon}