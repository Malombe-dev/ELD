# api/views.py - Complete API views with all endpoints

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.shortcuts import get_object_or_404
from datetime import datetime, timedelta
from django.http import FileResponse
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from rest_framework.permissions import AllowAny
from django.http import HttpResponse
from rest_framework import status
from datetime import datetime, timedelta
from .utils.route_calculator import RouteCalculator
from .utils.hos_calculator import HOSCalculator
from .serializers import TripInputSerializer
from .models import Trip, Stop
from reportlab.lib.pagesizes import A4

from .models import ELDLog, Trip
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
    Calculate route and generate HOS-compliant stops with proper timing
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
            # ✅ FIX: Get start_time from request
            start_time_str = request.data.get('start_time', '06:00')
            print(f"📅 Start time received: {start_time_str}")
            
            # ✅ FIX: Parse the start time to create proper datetime
            try:
                start_hour, start_minute = map(int, start_time_str.split(':'))
                current_time = datetime.now().replace(
                    hour=start_hour,
                    minute=start_minute,
                    second=0,
                    microsecond=0
                )
            except Exception as e:
                # Fallback to current time if parsing fails
                current_time = datetime.now()
                print(f"⚠️ Failed to parse time, using current: {current_time}")
            
            print(f"🕐 Using start time: {current_time.strftime('%I:%M %p')}")
            
            # Step 1: Calculate route
            route_calc = RouteCalculator()
            pickup_location = data.get('waypoints', [None])[0] or data['origin']
            
            route_data = route_calc.calculate_route(
                current_location=data['origin'],
                pickup_location=pickup_location,
                dropoff_location=data['destination']
            )
            
            # Step 2: Initialize HOS calculator
            hos_calc = HOSCalculator(
                current_cycle_hours=data.get('current_cycle_hours', 0)
            )
            
            # ✅ Step 3: Use HOSCalculator to generate HOS-compliant stops
            print("🚛 Calculating HOS-compliant stops...")
            stops_timeline = hos_calc.calculate_stops(route_data, start_time=current_time)
            
            # Extract stops and totals
            stops = stops_timeline['stops']
            total_driving_hours = stops_timeline['total_driving_hours']
            total_rest_hours = stops_timeline['total_rest_hours']
            total_hours = stops_timeline['total_hours']
            
            print(f"✅ Stops calculated: {len(stops)} stops")
            print(f"   Total driving: {total_driving_hours}h")
            print(f"   Total rest: {total_rest_hours}h")
            print(f"   Total duration: {total_hours}h")
            
            # Step 4: Save to database
            trip = Trip.objects.create(
                current_location=data['origin'],
                pickup_location=pickup_location,
                dropoff_location=data['destination'],
                current_cycle_hours=data.get('current_cycle_hours', 0),
                total_distance=route_data['total_distance'],
                total_duration_hours=total_hours,
                driving_hours=total_driving_hours,
                rest_hours=total_rest_hours
            )
            
            # Save stops to database
            for stop_data in stops:
                Stop.objects.create(
                    trip=trip,
                    stop_type=stop_data['type'],
                    location=stop_data['location'],
                    latitude=stop_data.get('latitude'),
                    longitude=stop_data.get('longitude'),
                    arrival_time=stop_data['arrival_time'],
                    departure_time=stop_data['departure_time'],
                    duration_hours=stop_data['duration_hours'],
                    notes=stop_data['notes'],
                    order=stop_data['order']
                )
            
            # Format response for frontend
            response_data = {
                'totalDistance': f"{route_data['total_distance']} miles",
                'totalDuration': f"{total_hours:.1f}h",
                'drivingTime': f"{total_driving_hours:.1f}h",
                'restTime': f"{total_rest_hours:.1f}h",
                'stops': [{
                    'type': s['type'],
                    'title': self._get_stop_title(s['type']),
                    'location': s['location'],
                    'time': s['arrival_time'].strftime('%I:%M %p'),
                    'duration': f"{s['duration_hours']}h" if s['duration_hours'] > 0 else None,
                    'notes': s['notes'],
                    'coordinates': [s.get('latitude'), s.get('longitude')]
                } for s in stops]
            }
            
            print(f"✅ Route calculated successfully")
            print(f"  Total stops: {len(stops)}")
            print(f"  Start time: {stops[0]['arrival_time'].strftime('%I:%M %p')}")
            print(f"  End time: {stops[-1]['departure_time'].strftime('%I:%M %p')}")
            
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
            trip_data = data.get('tripData', {})
            
            print("📨 Received data for saving:")
            print("Full data:", json.dumps(data, indent=2, default=str))
            print("Trip data:", json.dumps(trip_data, indent=2))
            
           
            trip = Trip.objects.create(
                current_location=trip_data.get('currentLocation', ''),
                pickup_location=trip_data.get('pickupLocation', ''),
                dropoff_location=trip_data.get('dropoffLocation', ''),
                current_cycle_hours=trip_data.get('currentCycleHours', 0),
                total_distance=data.get('totalMiles', 0),
                
            )
            
          
            log_date = datetime.strptime(data['date'], '%m/%d/%Y').date() if '/' in data['date'] else datetime.now().date()
            
            eld_log = ELDLog.objects.create(
                trip=trip,
                log_date=log_date,
                day_number=1,
                driver_name=trip_data.get('driverName', data.get('driver', 'Driver')),
                carrier_name=trip_data.get('carrierName', data.get('carrier', 'Carrier')),
              
                carrier_address=trip_data.get('carrierAddress', ''),
                home_terminal=trip_data.get('homeTerminal', ''),
                vehicle_number=trip_data.get('vehicleNumber', ''),
                trailer_number=trip_data.get('trailerNumber', ''),
               
                total_miles=data.get('totalMiles', 0),
                off_duty_hours=data.get('summary', {}).get('offDuty', 0),
                sleeper_berth_hours=data.get('summary', {}).get('sleeper', 0),
                driving_hours=data.get('summary', {}).get('driving', 0),
                on_duty_hours=data.get('summary', {}).get('onDuty', 0),
                remarks=data.get('remarks', '')
            )
            
           
            for segment in data.get('segments', []):
                LogSegment.objects.create(
                    log=eld_log,
                    status=segment['status'],
                    start_time=segment['start'],
                    end_time=segment['end'],
                    location=segment.get('location', '')
                )
            
            print(f"✅ Log saved successfully: {eld_log.id}")
            
            # Return saved log with ALL data
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
                        'currentCycleHours': log.trip.current_cycle_hours if log.trip else 0,
                       
                        'driverName': log.driver_name,
                        'carrierName': log.carrier_name,
                        'carrierAddress': log.carrier_address,
                        'homeTerminal': log.home_terminal,
                        'vehicleNumber': log.vehicle_number,
                        'trailerNumber': log.trailer_number
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
            'totalDistance': f"{trip.total_distance}",
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


class DownloadLogsPDFView(APIView):
    """
    POST /api/download-logs-pdf/
    Generate and download PDF of driver logs
    """
    permission_classes = [AllowAny]  # allow everyone, no login required

    def post(self, request, *args, **kwargs):
        # Get the most recent log
        eld_log = ELDLog.objects.order_by('-log_date').first()
        if not eld_log:
            return HttpResponse("No logs found", status=404)

        trip = eld_log.trip
        driver_name = getattr(eld_log, 'driver_name', 'Malombe')  # fallback name

        # Create PDF response
        response = HttpResponse(content_type="application/pdf")
        response['Content-Disposition'] = f'attachment; filename=\"daily_log_{driver_name}.pdf\"'

        # Setup PDF canvas
        p = canvas.Canvas(response, pagesize=A4)
        width, height = A4
        y = height - 50
        line_gap = 18

        def write(text, offset=line_gap, bold=False):
            nonlocal y
            font = "Helvetica-Bold" if bold else "Helvetica"
            p.setFont(font, 11)
            p.drawString(50, y, str(text))
            y -= offset

        # === HEADER ===
        p.setFont("Helvetica-Bold", 16)
        write("Driver's Daily Log", 25)
        p.setFont("Helvetica", 11)
        write(f"Date: {eld_log.log_date.strftime('%m/%d/%Y')}")
        write(f"Day: {eld_log.day_number}")
        write(f"Total Miles: {eld_log.total_miles}")
        write(f"Name of Carrier: {eld_log.carrier_name}")
        
        # Handle missing trip gracefully
        if trip:
            write(f"Main Office Address: {trip.pickup_location}")
            write(f"Home Terminal Address: {trip.dropoff_location}")
        else:
            write(f"Main Office Address: N/A")
            write(f"Home Terminal Address: N/A")
            
        write(f"Vehicle/Truck No.: {eld_log.vehicle_number or 'N/A'}")
        write(f"Trailer No.: T-{eld_log.id}")
        write("", 15)

        # === 24-HOUR GRID (labels) ===
        p.setFont("Helvetica-Bold", 12)
        write("24 Hour Grid", 25, bold=True)
        p.setFont("Helvetica", 10)
        p.drawString(50, y, " ".join(str(i) for i in range(24)))
        y -= 25

        # === STATUS SUMMARY ===
        p.setFont("Helvetica-Bold", 12)
        write("Hours Summary", 20)
        p.setFont("Helvetica", 10)
        write(f"Off Duty: {eld_log.off_duty_hours}h")
        write(f"Sleeper Berth: {eld_log.sleeper_berth_hours}h")
        write(f"Driving: {eld_log.driving_hours}h")
        write(f"On Duty: {eld_log.on_duty_hours}h")
        write("", 15)

        # === REMARKS ===
        p.setFont("Helvetica-Bold", 12)
        write("Remarks", 20)
        p.setFont("Helvetica", 10)
        write(eld_log.remarks or "No remarks.")
        write("", 15)

        # === ROUTE INFO ===
        if trip:
            p.setFont("Helvetica-Bold", 12)
            write("Trip Details", 20)
            p.setFont("Helvetica", 10)
            write(f"Origin: {trip.pickup_location}")
            write(f"Destination: {trip.dropoff_location}")
            write(f"Current Location: {trip.current_location}")
            write(f"Driving Hours: {trip.driving_hours or 0}h")
            write(f"Rest Hours: {trip.rest_hours or 0}h")
            write("", 15)

        # === FOOTER ===
        p.setFont("Helvetica-Bold", 12)
        write("Driver Signature", 20)
        p.setFont("Helvetica", 10)
        write(driver_name)

        # Finish and return
        p.showPage()
        p.save()
        return response