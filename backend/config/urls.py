from django.urls import path
from routing import views

urlpatterns = [
    path("api/health/", views.health),
    path("api/locations/", views.locations),
    path("api/analyze/", views.analyze),
    path("api/reassess/", views.reassess),
    path("api/departure/", views.departure),
    path("api/config/", views.configuration),
    path("", views.index),
]
