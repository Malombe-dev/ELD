# qpi/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('calculate-route/', views.CalculateRouteView.as_view(), name='calculate-route'),
    path('trips/', views.TripListView.as_view(), name='trip-list'),
    path('trips/<int:pk>/', views.TripDetailView.as_view(), name='trip-detail'),
]
