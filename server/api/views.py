# api/views.py - Complete API views with all endpoints

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.shortcuts import get_object_or_404
from datetime import datetime, timedelta
import json

from .models import Trip, Stop, ELDLog, LogSegment
from .serializers import (
    TripInputSerializer,
    StopSerializer,
    ELDLogSerializer,
    SaveLogSerializer
)
from .utils.route_calculator import RouteCalculator
from .utils.hos_calculator import HOSCalculator
from .utils.log_generator import LogGenerator


class CalculateRouteView(APIView):
    """
    POST /api/calculate-route/
    Calculate route and generate HOS-compliant stops
    """
    
    def post(self, request):
        serializer = TripInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid input', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        
        try:
            # Step 1: Calculate route
            route_calc = RouteCalculator()
            route_data = route_calc.calculate_route(
                current_location=data['origin'],
                pickup_location=data['waypoints'][0] if data.get('waypoints') else data['origin'],
                dropoff_location=data['destination']
            )
            
            # Step 2: Calculate HOS-compliant stops
            hos_calc = HOSCalculator(
                current_cycle_hours=data.get('current_cycle_hours', 0)
            )
            stops_timeline = hos_calc.calculate_stops(route_data)
            
            # Step 3: Save to database
            trip = Trip.objects.create(
                current_location=data['origin'],
                pickup_location=data.get('waypoints', [None])[0] or data['origin'],
                dropoff_location=data['destination'],
                current_cycle_hours=data.get('current_cycle_hours', 0),
                total_distance=route_data['total_distance'],
                total_duration_hours=stops_timeline['total_hours'],
                driving_hours=stops_timeline['total_driving_hours'],
                rest_hours=stops_timeline['total_rest_hours']
            )
            
            # Save stops
            for stop_data in stops_timeline['stops']:
                Stop.objects.create(
                    trip=trip,
                    stop_type=stop_data['type'],
                    location=stop_data['location'],
                    latitude=stop_data.get('latitude'),
                    longitude=stop_data.get('longitude'),
                    arrival_time=stop_data.get('arrival_time', datetime.now()),
                    departure_time=stop_data.get('departure_time', datetime.now()),
                    duration_hours=stop_data.get('duration_hours', 0),
                    notes=stop_data.get('notes', ''),
                    order=stop_data.get('order', 0)
                )
            
            # Format response to match frontend expectations
          
            response_data = {
                'totalDistance': f"{route_data['total_distance']} mi",
                'totalDuration': stops_timeline['total_duration_formatted'],
                'drivingTime': stops_timeline['driving_time_formatted'],
                'restTime': stops_timeline['rest_time_formatted'],
                'stops': [{
                    'type': s['type'],
                    'title': self._get_stop_title(s['type']),  # ← Generate title from type
                    'location': s['location'],
                    'time': s.get('arrival_time', datetime.now()).strftime('%I:%M %p') if 'arrival_time' in s else '',
                    'duration': f"{s.get('duration_hours', 0)}h" if s.get('duration_hours') else None,
                    'notes': s.get('notes', ''),
                    'coordinates': [s.get('latitude'), s.get('longitude')] if s.get('latitude') else None
                } for s in stops_timeline['stops']]
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_stop_title(self, stop_type):
        """Convert stop type to display title"""
        title_map = {
            'start': 'Start Location',
            'pickup': 'Pickup Location', 
            'dropoff': 'Dropoff Location',
            'fuel': 'Fuel Stop',
            'rest': 'Rest Break',
            'break': 'Required Break'
        }
        return title_map.get(stop_type, stop_type.title())
     
class SaveLogView(APIView):
    """
    POST /api/save-log/
    Save finalized daily log
    """
    
    def post(self, request):
        try:
            data = request.data
            
            # Create or get trip
            trip = Trip.objects.create(
                current_location=data.get('tripData', {}).get('currentLocation', ''),
                pickup_location=data.get('tripData', {}).get('pickupLocation', ''),
                dropoff_location=data.get('tripData', {}).get('dropoffLocation', ''),
                current_cycle_hours=data.get('tripData', {}).get('currentCycleHours', 0),
                total_distance=data.get('totalMiles', 0)
            )
            
            # Create ELD log
            log_date = datetime.strptime(data['date'], '%m/%d/%Y').date() if '/' in data['date'] else datetime.now().date()
            
            eld_log = ELDLog.objects.create(
                trip=trip,
                log_date=log_date,
                day_number=1,
                driver_name=data.get('driver', 'Driver'),
                carrier_name=data.get('carrier', 'Carrier'),
                total_miles=data.get('totalMiles', 0),
                off_duty_hours=data.get('summary', {}).get('offDuty', 0),
                sleeper_berth_hours=data.get('summary', {}).get('sleeper', 0),
                driving_hours=data.get('summary', {}).get('driving', 0),
                on_duty_hours=data.get('summary', {}).get('onDuty', 0),
                remarks=data.get('remarks', '')
            )
            
            # Save segments
            for segment in data.get('segments', []):
                LogSegment.objects.create(
                    log=eld_log,
                    status=segment['status'],
                    start_time=segment['start'],
                    end_time=segment['end'],
                    location=segment.get('location', '')
                )
            
            # Return saved log
            serializer = ELDLogSerializer(eld_log)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DriverLogsView(APIView):
    """
    GET /api/driver-logs/
    Retrieve all saved logs
    """
    
    def get(self, request):
        try:
            logs = ELDLog.objects.all().order_by('-log_date')
            
            logs_data = []
            for log in logs:
                segments = LogSegment.objects.filter(log=log).order_by('start_time')
                
                logs_data.append({
                    'id': log.id,
                    'date': log.log_date.strftime('%m/%d/%Y'),
                    'day_number': log.day_number,
                    'driver': log.driver_name,
                    'carrier': log.carrier_name,
                    'totalMiles': log.total_miles,
                    'summary': {
                        'offDuty': log.off_duty_hours,
                        'sleeper': log.sleeper_berth_hours,
                        'driving': log.driving_hours,
                        'onDuty': log.on_duty_hours
                    },
                    'segments': [{
                        'status': seg.status,
                        'start': seg.start_time,
                        'end': seg.end_time,
                        'location': seg.location
                    } for seg in segments],
                    'remarks': log.remarks,
                    'tripData': {
                        'currentLocation': log.trip.current_location if log.trip else '',
                        'pickupLocation': log.trip.pickup_location if log.trip else '',
                        'dropoffLocation': log.trip.dropoff_location if log.trip else '',
                        'driverName': log.driver_name,
                        'carrierName': log.carrier_name
                    }
                })
            
            return Response(logs_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TodayMileageView(APIView):
    """
    GET /api/today-mileage/
    Get today's total mileage
    """
    
    def get(self, request):
        try:
            today = datetime.now().date()
            logs = ELDLog.objects.filter(log_date=today)
            
            total_mileage = sum(log.total_miles for log in logs)
            
            return Response({
                'mileage': total_mileage,
                'date': today.strftime('%Y-%m-%d')
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TripListView(generics.ListAPIView):
    """
    GET /api/trips/
    List all trips
    """
    queryset = Trip.objects.all()
    
    def list(self, request, *args, **kwargs):
        trips = self.get_queryset()
        
        trips_data = []
        for trip in trips:
            trips_data.append({
                'id': trip.id,
                'currentLocation': trip.current_location,
                'pickupLocation': trip.pickup_location,
                'dropoffLocation': trip.dropoff_location,
                'totalDistance': trip.total_distance,
                'totalDuration': trip.total_duration_hours,
                'createdAt': trip.created_at.isoformat()
            })
        
        return Response(trips_data, status=status.HTTP_200_OK)


class TripDetailView(generics.RetrieveAPIView):
    """
    GET /api/trips/<id>/
    Get specific trip details
    """
    queryset = Trip.objects.all()
    
    def retrieve(self, request, *args, **kwargs):
        trip = self.get_object()
        stops = Stop.objects.filter(trip=trip).order_by('order')
        logs = ELDLog.objects.filter(trip=trip).order_by('log_date')
        
        trip_data = {
            'id': trip.id,
            'currentLocation': trip.current_location,
            'pickupLocation': trip.pickup_location,
            'dropoffLocation': trip.dropoff_location,
            'totalDistance': f"{trip.total_distance} mi",
            'totalDuration': f"{trip.total_duration_hours}h",
            'stops': [{
                'type': stop.stop_type,
                'location': stop.location,
                'time': stop.arrival_time.strftime('%I:%M %p'),
                'duration': f"{stop.duration_hours}h" if stop.duration_hours else None,
                'notes': stop.notes
            } for stop in stops],
            'logs': [{
                'date': log.log_date.strftime('%m/%d/%Y'),
                'totalMiles': log.total_miles,
                'summary': {
                    'offDuty': log.off_duty_hours,
                    'sleeper': log.sleeper_berth_hours,
                    'driving': log.driving_hours,
                    'onDuty': log.on_duty_hours
                }
            } for log in logs]
        }
        
        return Response(trip_data, status=status.HTTP_200_OK)