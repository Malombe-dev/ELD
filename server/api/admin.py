# api/admin.py - Django admin configuration

from django.contrib import admin
from .models import Trip, Stop, ELDLog, LogSegment


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['id', 'pickup_location', 'dropoff_location', 
                   'total_distance', 'created_at']
    list_filter = ['created_at']
    search_fields = ['pickup_location', 'dropoff_location']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ['trip', 'stop_type', 'location', 'arrival_time', 'order']
    list_filter = ['stop_type']
    search_fields = ['location']


@admin.register(ELDLog)
class ELDLogAdmin(admin.ModelAdmin):
    list_display = ['trip', 'log_date', 'day_number', 'driver_name', 'total_miles']
    list_filter = ['log_date']
    search_fields = ['driver_name', 'carrier_name']


@admin.register(LogSegment)
class LogSegmentAdmin(admin.ModelAdmin):
    list_display = ['log', 'status', 'start_time', 'end_time']
    list_filter = ['status']