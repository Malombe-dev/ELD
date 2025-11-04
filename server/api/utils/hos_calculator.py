# api/utils/hos_calculator.py - Hours of Service compliance calculations

from datetime import datetime, timedelta
from typing import List, Dict


class HOSCalculator:
    '''
    Calculate HOS-compliant stops and schedules based on FMCSA regulations
    '''
    
    # HOS Limits (Property-carrying, 70hr/8day)
    MAX_DRIVING_HOURS = 11
    MAX_DUTY_WINDOW = 14
    REQUIRED_REST_HOURS = 10
    BREAK_AFTER_DRIVING_HOURS = 8
    REQUIRED_BREAK_MINUTES = 30
    WEEKLY_LIMIT = 70
    WEEKLY_DAYS = 8
    
    def __init__(self, current_cycle_hours=0):
        self.current_cycle_hours = current_cycle_hours
        self.available_hours = self.WEEKLY_LIMIT - current_cycle_hours
    
    def calculate_stops(self, route_data):
        '''
        Generate HOS-compliant stop schedule
        '''
        stops = []
        current_time = datetime.now().replace(hour=6, minute=0, second=0, microsecond=0)
        
        # Calculate total segments
        segment1 = route_data['segment1']  # Current to Pickup
        segment2 = route_data['segment2']  # Pickup to Dropoff
        
        total_distance = route_data['total_distance']
        
        # Track driving hours and duty hours
        current_driving_hours = 0
        current_duty_hours = 0
        hours_since_break = 0
        day_number = 1
        
        # START
        stops.append({
            'type': 'start',
            'location': segment1['start'],
            'latitude': segment1['start_coords']['lat'],
            'longitude': segment1['start_coords']['lon'],
            'arrival_time': current_time,
            'departure_time': current_time + timedelta(hours=1),
            'duration_hours': 0,
            'notes': 'Trip start - Pre-trip inspection completed',
            'order': len(stops)
        })
        
        current_time += timedelta(hours=1)
        current_duty_hours += 1
        
        # Drive to PICKUP
        drive_time_to_pickup = segment1['duration_hours']
        fuel_stops_to_pickup = segment1['fuel_stops_needed']
        
        result = self._drive_segment(
            stops, current_time, current_driving_hours, current_duty_hours,
            hours_since_break, drive_time_to_pickup, fuel_stops_to_pickup,
            segment1['start_coords'], segment1['end_coords'],
            segment1['start'], segment1['end']
        )
        
        stops = result['stops']
        current_time = result['current_time']
        current_driving_hours = result['current_driving_hours']
        current_duty_hours = result['current_duty_hours']
        hours_since_break = result['hours_since_break']
        
        # PICKUP
        stops.append({
            'type': 'pickup',
            'location': segment1['end'],
            'latitude': segment1['end_coords']['lat'],
            'longitude': segment1['end_coords']['lon'],
            'arrival_time': current_time,
            'departure_time': current_time + timedelta(hours=1),
            'duration_hours': 1,
            'notes': 'Load cargo - 1 hour',
            'order': len(stops)
        })
        
        current_time += timedelta(hours=1)
        current_duty_hours += 1
        
        # Check if rest is needed after pickup
        if current_duty_hours >= self.MAX_DUTY_WINDOW or \
           current_driving_hours >= self.MAX_DRIVING_HOURS:
            
            stops.append({
                'type': 'rest',
                'location': segment1['end'],
                'latitude': segment1['end_coords']['lat'],
                'longitude': segment1['end_coords']['lon'],
                'arrival_time': current_time,
                'departure_time': current_time + timedelta(hours=self.REQUIRED_REST_HOURS),
                'duration_hours': self.REQUIRED_REST_HOURS,
                'notes': 'Required 10-hour rest - HOS compliance',
                'order': len(stops)
            })
            
            current_time += timedelta(hours=self.REQUIRED_REST_HOURS)
            current_driving_hours = 0
            current_duty_hours = 0
            hours_since_break = 0
            day_number += 1
        
        # Drive to DROPOFF
        drive_time_to_dropoff = segment2['duration_hours']
        fuel_stops_to_dropoff = segment2['fuel_stops_needed']
        
        result = self._drive_segment(
            stops, current_time, current_driving_hours, current_duty_hours,
            hours_since_break, drive_time_to_dropoff, fuel_stops_to_dropoff,
            segment2['start_coords'], segment2['end_coords'],
            segment2['start'], segment2['end']
        )
        
        stops = result['stops']
        current_time = result['current_time']
        current_driving_hours = result['current_driving_hours']
        current_duty_hours = result['current_duty_hours']
        
        # DROPOFF
        stops.append({
            'type': 'dropoff',
            'location': segment2['end'],
            'latitude': segment2['end_coords']['lat'],
            'longitude': segment2['end_coords']['lon'],
            'arrival_time': current_time,
            'departure_time': current_time + timedelta(hours=1),
            'duration_hours': 1,
            'notes': 'Unload cargo - Trip complete',
            'order': len(stops)
        })
        
        # Calculate totals
        total_driving_hours = sum(s.get('duration_hours', 0) for s in stops 
                                 if s['type'] not in ['rest', 'pickup', 'dropoff'])
        total_rest_hours = sum(s.get('duration_hours', 0) for s in stops 
                              if s['type'] == 'rest')
        total_hours = (stops[-1]['departure_time'] - stops[0]['arrival_time']).total_seconds() / 3600
        
        return {
            'stops': stops,
            'total_driving_hours': round(total_driving_hours, 1),
            'total_rest_hours': round(total_rest_hours, 1),
            'total_hours': round(total_hours, 1),
            'total_duration_formatted': self._format_duration(total_hours),
            'driving_time_formatted': self._format_duration(total_driving_hours),
            'rest_time_formatted': self._format_duration(total_rest_hours),
            'total_days': day_number
        }
    
    def _drive_segment(self, stops, current_time, current_driving_hours, 
                      current_duty_hours, hours_since_break, segment_drive_time,
                      fuel_stops_count, start_coords, end_coords, start_loc, end_loc):
        '''
        Handle driving a segment with breaks and rest periods
        '''
        remaining_drive_time = segment_drive_time
        distance_driven = 0
        
        while remaining_drive_time > 0:
            # Check if break needed (every 8 hours of driving)
            if hours_since_break >= self.BREAK_AFTER_DRIVING_HOURS:
                # 30-minute break
                stops.append({
                    'type': 'break',
                    'location': self._interpolate_location(
                        start_loc, end_loc, 
                        distance_driven / segment_drive_time
                    ),
                    'latitude': None,
                    'longitude': None,
                    'arrival_time': current_time,
                    'departure_time': current_time + timedelta(minutes=self.REQUIRED_BREAK_MINUTES),
                    'duration_hours': 0.5,
                    'notes': 'Required 30-minute break',
                    'order': len(stops)
                })
                current_time += timedelta(minutes=self.REQUIRED_BREAK_MINUTES)
                current_duty_hours += 0.5
                hours_since_break = 0
            
            # Check if rest needed (11-hour driving or 14-hour duty limit)
            if current_driving_hours >= self.MAX_DRIVING_HOURS or \
               current_duty_hours >= self.MAX_DUTY_WINDOW:
                
                stops.append({
                    'type': 'rest',
                    'location': self._interpolate_location(
                        start_loc, end_loc,
                        distance_driven / segment_drive_time
                    ),
                    'latitude': None,
                    'longitude': None,
                    'arrival_time': current_time,
                    'departure_time': current_time + timedelta(hours=self.REQUIRED_REST_HOURS),
                    'duration_hours': self.REQUIRED_REST_HOURS,
                    'notes': 'Required 10-hour rest - HOS compliance',
                    'order': len(stops)
                })
                
                current_time += timedelta(hours=self.REQUIRED_REST_HOURS)
                current_driving_hours = 0
                current_duty_hours = 0
                hours_since_break = 0
                continue
            
            # Calculate how much we can drive
            can_drive_before_break = self.BREAK_AFTER_DRIVING_HOURS - hours_since_break
            can_drive_before_limit = min(
                self.MAX_DRIVING_HOURS - current_driving_hours,
                self.MAX_DUTY_WINDOW - current_duty_hours
            )
            can_drive = min(can_drive_before_break, can_drive_before_limit, remaining_drive_time)
            
            # Add fuel stop if needed (every 1000 miles approximately)
            if fuel_stops_count > 0 and distance_driven + can_drive * 55 >= 1000:
                fuel_drive_time = (1000 - distance_driven) / 55
                
                current_time += timedelta(hours=fuel_drive_time)
                current_driving_hours += fuel_drive_time
                current_duty_hours += fuel_drive_time
                hours_since_break += fuel_drive_time
                remaining_drive_time -= fuel_drive_time
                distance_driven = 0
                fuel_stops_count -= 1
                
                # Fuel stop
                stops.append({
                    'type': 'fuel',
                    'location': self._interpolate_location(
                        start_loc, end_loc,
                        (segment_drive_time - remaining_drive_time) / segment_drive_time
                    ),
                    'latitude': None,
                    'longitude': None,
                    'arrival_time': current_time,
                    'departure_time': current_time + timedelta(minutes=30),
                    'duration_hours': 0.5,
                    'notes': 'Fuel stop - 30 minutes',
                    'order': len(stops)
                })
                
                current_time += timedelta(minutes=30)
                current_duty_hours += 0.5
                # Fuel stop can count as break
                hours_since_break = 0
                continue
            
            # Drive
            current_time += timedelta(hours=can_drive)
            current_driving_hours += can_drive
            current_duty_hours += can_drive
            hours_since_break += can_drive
            remaining_drive_time -= can_drive
            distance_driven += can_drive * 55
        
        return {
            'stops': stops,
            'current_time': current_time,
            'current_driving_hours': current_driving_hours,
            'current_duty_hours': current_duty_hours,
            'hours_since_break': hours_since_break
        }
    
    def _interpolate_location(self, start, end, fraction):
        '''
        Create a location name between start and end
        '''
        if fraction < 0.3:
            return f"En route from {start}"
        elif fraction > 0.7:
            return f"Approaching {end}"
        else:
            return f"En route: {start} to {end}"
    
    def _format_duration(self, hours):
        '''
        Format hours into readable string
        '''
        days = int(hours // 24)
        remaining_hours = int(hours % 24)
        
        if days > 0:
            return f"{days}d {remaining_hours}h"
        return f"{remaining_hours}h"