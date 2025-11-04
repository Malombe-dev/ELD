# geocoding.py
import requests
import time
from django.conf import settings

class GeocodingService:
    def __init__(self):
        self.openroute_api_key = settings.OPENROUTE_API_KEY
        self.cache = {}
    
    def geocode(self, location_name):
        """Geocode a location name to coordinates"""
        if not location_name or location_name.strip() == "":
            return None
            
        location_name = location_name.strip()
        
        # Check cache first
        if location_name.lower() in self.cache:
            print(f"📍 Using cached coordinates for: {location_name}")
            return self.cache[location_name.lower()]
        
        print(f"🔍 Geocoding: {location_name}")
        
        # Try OpenRouteService first
        result = self._geocode_openroute(location_name)
        
        # If OpenRouteService fails, try OpenStreetMap Nominatim as fallback
        if not result:
            print(f"🔄 OpenRouteService failed, trying Nominatim for: {location_name}")
            result = self._geocode_nominatim(location_name)
        
        if result:
            print(f"✅ Geocoding successful: {location_name} -> {result}")
            self.cache[location_name.lower()] = result
        else:
            print(f"❌ Geocoding failed: {location_name}")
        
        return result
    
    def _geocode_openroute(self, location_name):
        """Try OpenRouteService with retries"""
        for attempt in range(3):
            try:
                print(f"  Trying OpenRouteService (attempt {attempt + 1}/3)...")
                
                response = requests.get(
                    "https://api.openrouteservice.org/geocode/search",
                    params={
                        'api_key': self.openroute_api_key,
                        'text': location_name,
                        'size': 1
                    },
                    timeout=10
                )
                
                print(f"  OpenRouteService status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('features') and len(data['features']) > 0:
                        coords = data['features'][0]['geometry']['coordinates']
                        # OpenRouteService returns [lon, lat]
                        result = {
                            'lon': coords[0],
                            'lat': coords[1],
                            'source': 'openroute'
                        }
                        print(f"  ✅ OpenRouteService found: {result}")
                        return result
                    else:
                        print(f"  ❌ OpenRouteService: No features found in response")
                
            except requests.exceptions.Timeout:
                print(f"  ⏰ Timeout on attempt {attempt + 1} for '{location_name}'")
                if attempt < 2:
                    time.sleep(2)
                continue
            except Exception as e:
                print(f"  ❌ OpenRouteService error: {e}")
                break
        
        return None
    
    def _geocode_nominatim(self, location_name):
        """Fallback to OpenStreetMap Nominatim"""
        try:
            print(f"  Trying Nominatim...")
            
            response = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    'q': location_name,
                    'format': 'json',
                    'limit': 1
                },
                timeout=10,
                headers={'User-Agent': 'ELD-Log-Generator/1.0'}
            )
            
            print(f"  Nominatim status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    # Nominatim returns {'lat': '1.234', 'lon': '5.678'} as strings
                    result = {
                        'lon': float(data[0]['lon']),
                        'lat': float(data[0]['lat']),
                        'source': 'nominatim'
                    }
                    print(f"  ✅ Nominatim found: {result}")
                    return result
                else:
                    print(f"  ❌ Nominatim: No results found")
                    
        except Exception as e:
            print(f"  ❌ Nominatim error: {e}")
        
        return None
    
    def calculate_distance(self, coord1, coord2):
        """Calculate approximate distance using Haversine formula"""
        from math import radians, sin, cos, sqrt, atan2
        
        # Extract lat/lon from coordinate dictionaries
        lat1, lon1 = coord1[0], coord1[1]  # coord1 is (lat, lon) tuple
        lat2, lon2 = coord2[0], coord2[1]  # coord2 is (lat, lon) tuple
        
        # Convert to radians
        lat1, lon1 = radians(lat1), radians(lon1)
        lat2, lon2 = radians(lat2), radians(lon2)
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        # Earth radius in miles
        radius = 3958.8
        distance = radius * c
        
        print(f"📏 Distance calculation: {distance:.1f} miles")
        return distance


class OpenRouteService:
    """Placeholder for routing functionality"""
    def __init__(self):
        self.api_key = settings.OPENROUTE_API_KEY