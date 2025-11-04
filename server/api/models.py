from django.db import models
from django.contrib.auth.models import User

class Trip(models.Model):
    # Trip details
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_hours = models.FloatField(default=0)
    
    # Calculated data
    total_distance = models.FloatField(null=True, blank=True)
    total_duration_hours = models.FloatField(null=True, blank=True)
    driving_hours = models.FloatField(null=True, blank=True)
    rest_hours = models.FloatField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Trip: {self.pickup_location} to {self.dropoff_location}"


class Stop(models.Model):
    STOP_TYPES = [
        ('start', 'Start'),
        ('pickup', 'Pickup'),
        ('dropoff', 'Dropoff'),
        ('fuel', 'Fuel'),
        ('rest', 'Rest'),
        ('break', 'Break'),
    ]
    
    trip = models.ForeignKey(Trip, related_name='stops', on_delete=models.CASCADE)
    stop_type = models.CharField(max_length=20, choices=STOP_TYPES)
    location = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    arrival_time = models.DateTimeField()
    departure_time = models.DateTimeField(null=True, blank=True)
    duration_hours = models.FloatField(default=0)
    
    notes = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return f"{self.get_stop_type_display()} - {self.location}"


class ELDLog(models.Model):
    trip = models.ForeignKey(Trip, related_name='logs', on_delete=models.CASCADE)
    log_date = models.DateField()
    day_number = models.IntegerField()
    
    driver_name = models.CharField(max_length=255, default='Driver')
    carrier_name = models.CharField(max_length=255, default='Carrier')
    vehicle_number = models.CharField(max_length=100, blank=True)
    
    total_miles = models.FloatField(default=0)
    
    # Hours summary
    off_duty_hours = models.FloatField(default=0)
    sleeper_berth_hours = models.FloatField(default=0)
    driving_hours = models.FloatField(default=0)
    on_duty_hours = models.FloatField(default=0)
    
    remarks = models.TextField(blank=True)
    
    class Meta:
        ordering = ['log_date']
    
    def __str__(self):
        return f"Log Day {self.day_number} - {self.log_date}"


class LogSegment(models.Model):
    STATUS_CHOICES = [
        (0, 'Off Duty'),
        (1, 'Sleeper Berth'),
        (2, 'Driving'),
        (3, 'On Duty'),
    ]
    
    log = models.ForeignKey(ELDLog, related_name='segments', on_delete=models.CASCADE)
    status = models.IntegerField(choices=STATUS_CHOICES)
    start_time = models.FloatField()  # Hour in 24-hour format (0-24)
    end_time = models.FloatField()    # Hour in 24-hour format (0-24)
    location = models.CharField(max_length=255, blank=True)
    
    class Meta:
        ordering = ['start_time']
    
    def __str__(self):
        return f"{self.get_status_display()}: {self.start_time} - {self.end_time}"
"""

# ===================================================================
# FILE 7: api/serializers.py
# ===================================================================
"""
# api/serializers.py - DRF serializers for API data

from rest_framework import serializers
from .models import Trip, Stop, ELDLog, LogSegment


class TripInputSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_hours = serializers.FloatField(min_value=0, max_value=70)


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


class RouteResponseSerializer(serializers.Serializer):
    totalDistance = serializers.FloatField()
    totalDuration = serializers.CharField()
    drivingTime = serializers.CharField()
    restTime = serializers.CharField()
    stops = StopSerializer(many=True)
    logs = ELDLogSerializer(many=True)