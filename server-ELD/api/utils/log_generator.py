# api/utils/log_generator.py - ELD log sheet generation

from datetime import datetime, timedelta
from typing import List, Dict


class LogGenerator:
    '''
    Generate ELD log sheets from stop timeline
    '''
    
    def generate_logs(self, stops_timeline, route_data):
        '''
        Generate daily ELD logs from stops timeline
        '''
        stops = stops_timeline['stops']
        logs = []
        
        # Group stops by day
        current_day_start = stops[0]['arrival_time'].replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_number = 1
        
        while current_day_start < stops[-1]['departure_time']:
            day_end = current_day_start + timedelta(days=1)
            
            # Get stops for this day
            day_stops = [s for s in stops 
                        if s['arrival_time'] >= current_day_start and 
                        s['arrival_time'] < day_end]
            
            if not day_stops:
                current_day_start = day_end
                continue
            
            # Generate log for this day
            log = self._generate_daily_log(
                day_stops, current_day_start, day_number, 
                route_data, stops_timeline
            )
            logs.append(log)
            
            current_day_start = day_end
            day_number += 1
        
        return logs
    
    def _generate_daily_log(self, day_stops, date, day_number, route_data, stops_timeline):
        '''
        Generate a single day's ELD log
        '''
        segments = []
        summary = {
            'off_duty': 0,
            'sleeper': 0,
            'driving': 0,
            'on_duty': 0
        }
        
        # Calculate miles for this day
        daily_miles = sum(
            self._calculate_stop_miles(stop, route_data) 
            for stop in day_stops
        )
        
        # Generate segments for the day
        current_hour = 0
        last_stop_end = 0
        
        for stop in day_stops:
            stop_start_hour = (stop['arrival_time'] - date).total_seconds() / 3600
            stop_end_hour = (stop['departure_time'] - date).total_seconds() / 3600
            
            # Clamp to 0-24 range
            stop_start_hour = max(0, min(24, stop_start_hour))
            stop_end_hour = max(0, min(24, stop_end_hour))
            
            duration = stop_end_hour - stop_start_hour
            
            # Fill gap with off-duty if needed
            if stop_start_hour > last_stop_end:
                gap_duration = stop_start_hour - last_stop_end
                segments.append({
                    'status': 0,  # Off duty
                    'start': last_stop_end,
                    'end': stop_start_hour,
                    'location': ''
                })
                summary['off_duty'] += gap_duration
            
            # Add stop segment
            status = self._get_status_from_stop_type(stop['stop_type'])
            segments.append({
                'status': status,
                'start': stop_start_hour,
                'end': stop_end_hour,
                'location': stop['location']
            })
            
            # Update summary
            status_key = ['off_duty', 'sleeper', 'driving', 'on_duty'][status]
            summary[status_key] += duration
            
            last_stop_end = stop_end_hour
        
        # Fill remaining time with off-duty
        if last_stop_end < 24:
            segments.append({
                'status': 0,
                'start': last_stop_end,
                'end': 24,
                'location': ''
            })
            summary['off_duty'] += (24 - last_stop_end)
        
        # Generate remarks
        remarks = self._generate_remarks(day_stops, route_data)
        
        return {
            'date': date.strftime('%m/%d/%Y'),
            'day_number': day_number,
            'driver': 'John Doe',
            'carrier': 'Transport Co.',
            'total_miles': round(daily_miles, 1),
            'segments': segments,
            'summary': {
                'offDuty': round(summary['off_duty'], 1),
                'sleeper': round(summary['sleeper'], 1),
                'driving': round(summary['driving'], 1),
                'onDuty': round(summary['on_duty'], 1)
            },
            'remarks': remarks
        }
    
    def _get_status_from_stop_type(self, stop_type):
        '''
        Convert stop type to log status code
        0: Off Duty, 1: Sleeper Berth, 2: Driving, 3: On Duty
        '''
        mapping = {
            'start': 3,
            'pickup': 3,
            'dropoff': 3,
            'fuel': 3,
            'rest': 1,
            'break': 0,
            'driving': 2
        }
        return mapping.get(stop_type, 0)
    
    def _calculate_stop_miles(self, stop, route_data):
        '''
        Estimate miles driven during this stop
        '''
        if stop['stop_type'] in ['rest', 'break', 'pickup', 'dropoff', 'start']:
            return 0
        
        # Rough estimate: duration * 55 mph average
        return stop.get('duration_hours', 0) * 55
    
    def _generate_remarks(self, day_stops, route_data):
        '''
        Generate remarks for the log
        '''
        remarks_parts = []
        
        for stop in day_stops:
            if stop['stop_type'] in ['start', 'pickup', 'dropoff']:
                remarks_parts.append(f"{stop['location']}")
        
        if len(remarks_parts) == 0:
            return "En route"
        
        return " → ".join(remarks_parts)
