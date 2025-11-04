import requests
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from django.conf import settings


class GeocodingService:
    '''
    Handle geocoding and reverse geocoding operations
    '''
    
    def __init__(self):
        self.geolocator = Nominatim(user_agent="eld_log_generator")
    
    def geocode(self, location_string):
        '''
        Convert address string to coordinates
        Returns: {'lat': float, 'lon': float, 'display_name': str}
        '''
        try:
            location = self.geolocator.geocode(location_string)
            if location:
                return {
                    'lat': location.latitude,
                    'lon': location.longitude,
                    'display_name': location.address
                }
            return None
        except Exception as e:
            print(f"Geocoding error: {e}")
            return None
    
    def reverse_geocode(self, lat, lon):
        '''
        Convert coordinates to address
        '''
        try:
            location = self.geolocator.reverse(f"{lat}, {lon}")
            if location:
                return location.address
            return None
        except Exception as e:
            print(f"Reverse geocoding error: {e}")
            return None
    
    def calculate_distance(self, point1, point2):
        '''
        Calculate distance between two points in miles
        point1, point2: tuples of (lat, lon)
        '''
        distance_km = geodesic(point1, point2).kilometers
        distance_miles = distance_km * 0.621371
        return distance_miles


class OpenRouteService:
    '''
    Interface with OpenRouteService API for routing
    '''
    
    def __init__(self):
        self.api_key = settings.OPENROUTE_API_KEY
        self.base_url = "https://api.openrouteservice.org/v2"
    
    def get_route(self, coordinates):
        '''
        Get route between multiple coordinates
        coordinates: list of [lon, lat] pairs
        '''
        if not self.api_key:
            raise Exception("OpenRouteService API key not configured")
        
        url = f"{self.base_url}/directions/driving-car"
        
        headers = {
            'Authorization': self.api_key,
            'Content-Type': 'application/json'
        }
        
        payload = {
            'coordinates': coordinates,
            'instructions': True,
            'units': 'mi'
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"OpenRouteService error: {e}")
            return None