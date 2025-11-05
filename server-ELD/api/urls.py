# api/urls.py - COMPLETE URL CONFIGURATION
from django.urls import path
from . import views

urlpatterns = [
    # Route calculation
    path('calculate-route/', views.CalculateRouteView.as_view(), name='calculate-route'),
    
    # Log management - THESE WERE MISSING!
    path('save-log/', views.SaveLogView.as_view(), name='save-log'),
    path('driver-logs/', views.DriverLogsView.as_view(), name='driver-logs'),
    path('today-mileage/', views.TodayMileageView.as_view(), name='today-mileage'),
    
    # Trip management
    path('trips/', views.TripListView.as_view(), name='trip-list'),
    path('trips/<int:pk>/', views.TripDetailView.as_view(), name='trip-detail'),
    
    path('download-logs-pdf/', views.DownloadLogsPDFView.as_view(), name='download_logs_pdf'),
]