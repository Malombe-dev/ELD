# api/serializers.py - DRF serializers for API data

from rest_framework import serializers
from .models import Trip, Stop, ELDLog, LogSegment



class TripInputSerializer(serializers.Serializer):
    origin = serializers.CharField(max_length=255)        
    destination = serializers.CharField(max_length=255)   
    waypoints = serializers.ListField(required=False)      
    current_cycle_hours = serializers.FloatField(min_value=0, max_value=70, required=False, default=0)
    driver_name = serializers.CharField(max_length=255, required=False)
    carrier_name = serializers.CharField(max_length=255, required=False)


class LogSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogSegment
        fields = ['status', 'start_time', 'end_time', 'location']


class ELDLogSerializer(serializers.ModelSerializer):
    segments = LogSegmentSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()
    
    class Meta:
        model = ELDLog
        fields = [
            'log_date', 'day_number', 'driver_name', 'carrier_name',
            'total_miles', 'segments', 'summary', 'remarks'
        ]
    
    def get_summary(self, obj):
        return {
            'offDuty': obj.off_duty_hours,
            'sleeper': obj.sleeper_berth_hours,
            'driving': obj.driving_hours,
            'onDuty': obj.on_duty_hours,
        }


class StopSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source='stop_type')
    time = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    
    class Meta:
        model = Stop
        fields = ['type', 'title', 'location', 'time', 'duration', 'notes']
    
    def get_time(self, obj):
        return obj.arrival_time.strftime('%b %d, %I:%M %p')
    
    def get_duration(self, obj):
        if obj.duration_hours > 0:
            return f"{obj.duration_hours} hours"
        return None
    
    def get_title(self, obj):
        return obj.get_stop_type_display()
    


class SaveLogSerializer(serializers.Serializer):
    date = serializers.CharField()
    segments = serializers.ListField()
    totalMiles = serializers.FloatField()
    summary = serializers.DictField()
    tripData = serializers.DictField()
    remarks = serializers.CharField(required=False, allow_blank=True)
    driver = serializers.CharField(required=False)
    carrier = serializers.CharField(required=False)    


class RouteResponseSerializer(serializers.Serializer):
    totalDistance = serializers.FloatField()
    totalDuration = serializers.CharField()
    drivingTime = serializers.CharField()
    restTime = serializers.CharField()
    stops = StopSerializer(many=True)
    logs = ELDLogSerializer(many=True)