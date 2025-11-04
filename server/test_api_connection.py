# test_api_connection.py
import requests
import os
from django.conf import settings

def test_openroute_connection():
    api_key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjNjZDQ1ZjNkNDUwZDQzNTQ5ZDZhZTBlZmJiNmY1ZTgwIiwiaCI6Im11cm11cjY0In0="
    
    print("Testing OpenRouteService API connection...")
    print(f"API Key: {api_key[:20]}...")
    
    try:
        # Test geocoding endpoint
        response = requests.get(
            "https://api.openrouteservice.org/geocode/search",
            params={
                'api_key': api_key,
                'text': 'nairobi',
                'size': 1
            },
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS: API is responding!")
            print(f"Response data: {data}")
            return True
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response text: {response.text[:500]}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ TIMEOUT: Request timed out after 10 seconds")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ CONNECTION ERROR: Cannot reach OpenRouteService API")
        return False
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
        return False

def test_nominatim_connection():
    print("\nTesting OpenStreetMap Nominatim connection...")
    
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                'q': 'nairobi',
                'format': 'json',
                'limit': 1
            },
            timeout=10,
            headers={'User-Agent': 'ELD-Test/1.0'}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS: Nominatim is responding!")
            print(f"Found location: {data[0]['display_name'] if data else 'None'}")
            return True
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    test_openroute_connection()
    test_nominatim_connection()