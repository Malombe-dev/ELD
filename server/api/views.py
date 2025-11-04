# api/views.py - API views and endpoints

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.shortcuts import get_object_or_404

from .models import Trip, Stop, ELDLog, LogSegment
from .serializers import (
    TripInputSerializer,
    RouteResponseSerializer,
    StopSerializer,
    ELDLogSerializer
)
from .utils.route_calculator import RouteCalculator
from .utils.hos_calculator import HOSCalculator
from .utils.log_generator import LogGenerator


class CalculateRouteView(APIView):
    """
    POST endpoint to calculate route and generate ELD logs
    """
    
    def post(self, request):
        # Validate input
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
                current_location=data['current_location'],
                pickup_location=data['pickup_location'],
                dropoff_location=data['dropoff_location']
            )
            
            # Step 2: Calculate HOS-compliant stops
            hos_calc = HOSCalculator(
                current_cycle_hours=data['current_cycle_hours']
            )
            stops_timeline = hos_calc.calculate_stops(route_data)
            
            # Step 3: Generate ELD logs
            log_gen = LogGenerator()
            logs = log_gen.generate_logs(stops_timeline, route_data)
            
            # Step 4: Save to database
            trip = Trip.objects.create(
                current_location=data['current_location'],
                pickup_location=data['pickup_location'],
                dropoff_location=data['dropoff_location'],
                current_cycle_hours=data['current_cycle_hours'],
                total_distance=route_data['total_distance'],
                total_duration_hours=route_data['total_duration_hours'],
                driving_hours=stops_timeline['total_driving_hours'],
                rest_hours=stops_timeline['total_rest_hours']
            )
            
            # Save stops
            for stop_data in stops_timeline['stops']:
                Stop.objects.create(trip=trip, **stop_data)
            
            # Save logs
            for log_data in logs:
                eld_log = ELDLog.objects.create(
                    trip=trip,
                    log_date=log_data['date'],
                    day_number=log_data['day_number'],
                    driver_name=log_data.get('driver', 'Driver'),
                    carrier_name=log_data.get('carrier', 'Carrier'),
                    total_miles=log_data['total_miles'],
                    off_duty_hours=log_data['summary']['off_duty'],
                    sleeper_berth_hours=log_data['summary']['sleeper'],
                    driving_hours=log_data['summary']['driving'],
                    on_duty_hours=log_data['summary']['on_duty'],
                    remarks=log_data.get('remarks', '')
                )
                
                # Save segments
                for segment in log_data['segments']:
                    LogSegment.objects.create(
                        log=eld_log,
                        status=segment['status'],
                        start_time=segment['start'],
                        end_time=segment['end'],
                        location=segment.get('location', '')
                    )
            
            # Format response
            response_data = {
                'totalDistance': route_data['total_distance'],
                'totalDuration': stops_timeline['total_duration_formatted'],
                'drivingTime': stops_timeline['driving_time_formatted'],
                'restTime': stops_timeline['rest_time_formatted'],
                'stops': stops_timeline['stops'],
                'logs': logs
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TripListView(generics.ListAPIView):
    """
    GET endpoint to list all trips
    """
    queryset = Trip.objects.all()
    serializer_class = RouteResponseSerializer


class TripDetailView(generics.RetrieveAPIView):
    """
    GET endpoint to retrieve a specific trip
    """
    queryset = Trip.objects.all()
    serializer_class = RouteResponseSerializer