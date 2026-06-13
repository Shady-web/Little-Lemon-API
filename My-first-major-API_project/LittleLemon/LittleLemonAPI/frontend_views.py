from django.shortcuts import render
from django.conf import settings


def home(request):
    return render(request, 'home.html')


def menu(request):
    return render(request, 'menu.html')


def cart(request):
    return render(request, 'cart.html')


def orders(request):
    return render(request, 'orders.html')


def auth_page(request):
    return render(request, 'auth.html', {
        'google_client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
    })
