from django.contrib import admin
from django.urls import path, include
from LittleLemonAPI import frontend_views

urlpatterns = [
    path("admin/", admin.site.urls),

    # Frontend pages
    path('', frontend_views.home, name='home'),
    path('menu/', frontend_views.menu, name='menu'),
    path('cart/', frontend_views.cart, name='cart'),
    path('orders/', frontend_views.orders, name='orders'),
    path('login/', frontend_views.auth_page, name='auth'),

    # REST API
    path('api/', include('LittleLemonAPI.urls')),
    path('auth/', include('djoser.urls')),
    path('auth/', include('djoser.urls.authtoken')),
]
