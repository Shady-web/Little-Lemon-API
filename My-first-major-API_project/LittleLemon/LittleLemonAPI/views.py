import json
from urllib.request import urlopen
from urllib.error import URLError

from django.shortcuts import get_object_or_404
from django.conf import settings as django_settings
from rest_framework import generics, viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.contrib.auth.models import Group, User
from django.utils import timezone

from .models import MenuItems, Category, Cart, OrderItems, Order
from .serializers import (MenuItemsSerializer, CategorySerializer, CartSerializer,
                          UserSerializer, OrderSerializer)
from .permissions import IsAdminOrManagerPermission
from .throttles import OneCallPerMinute


# ── Google OAuth ─────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """Accept a Google ID token, verify it, and return a DRF auth token."""
    credential = request.data.get('credential', '').strip()
    if not credential:
        return Response({'error': 'No credential provided.'}, status=status.HTTP_400_BAD_REQUEST)

    # Verify with Google's tokeninfo endpoint (stdlib only, no extra deps)
    try:
        url = f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}'
        with urlopen(url, timeout=10) as resp:
            info = json.loads(resp.read().decode())
    except Exception:
        return Response({'error': 'Could not verify Google token.'}, status=status.HTTP_400_BAD_REQUEST)

    if 'error' in info or 'error_description' in info:
        return Response({'error': 'Invalid Google token.'}, status=status.HTTP_400_BAD_REQUEST)

    # Optionally verify the token was issued for our app
    client_id = getattr(django_settings, 'GOOGLE_CLIENT_ID', '')
    if client_id and info.get('aud') != client_id:
        return Response({'error': 'Token audience mismatch.'}, status=status.HTTP_400_BAD_REQUEST)

    email = info.get('email', '').lower()
    if not email:
        return Response({'error': 'No email in Google token.'}, status=status.HTTP_400_BAD_REQUEST)

    # Get or create by email — works even after a DB reset
    user = User.objects.filter(email=email).first()
    if not user:
        base = email.split('@')[0].replace('.', '_').replace('-', '_')[:20]
        username, n = base, 1
        while User.objects.filter(username=username).exists():
            username = f'{base}{n}'; n += 1
        user = User.objects.create_user(
            username=username, email=email,
            first_name=info.get('given_name', ''),
            last_name=info.get('family_name', ''),
        )
        user.set_unusable_password()
        user.save()

    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'auth_token': token.key, 'username': user.username})

class CategoriesView(generics.ListCreateAPIView, generics.DestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        permission_classes = []
        if self.request.method != 'GET':
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

class MenuItemsView(generics.ListCreateAPIView):
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    queryset = MenuItems.objects.all().order_by('id')
    serializer_class = MenuItemsSerializer
    ordering_fields = ['price', 'inventory']
    search_fields = ['title', 'category__title']

    def get_permissions(self):
        permission_classes = []
        if self.request.method != 'GET':
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

class SingleMenuItemView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MenuItems.objects.all()
    serializer_class = MenuItemsSerializer 

    def get_permissions(self):
        permission_classes = []
        if self.request.method != 'GET':
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]   

class CartView(generics.ListCreateAPIView):# generics.RetrieveUpdateDestroyAPIView):   
    queryset = Cart.objects.all() 
    serializer_class = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
         #current_user = self.request.user
         return Cart.objects.all().filter(user=self.request.user)
    
    def delete(self, request, *args, **kwargs):
        Cart.objects.all().filter(user=self.request.user).delete()

        return Response({'message':'all menu items in the cart have been deleted'}, status=status.HTTP_204_NO_CONTENT)

class ManagerViewSet(viewsets.ViewSet):
     throttle_classes = [UserRateThrottle]
     permission_classes = [IsAdminOrManagerPermission]
     
     def list(self, request): #retrives managers data
        users = User.objects.all().filter(groups__name="manager")
        items = UserSerializer(users, many=True)
        return Response(items.data)
     
     def create(self, request):
        user = get_object_or_404(user, username = request.data['username'])
        managers = Group.objects.get(name='manager')
        managers.user_set.add(user)
        return Response({"message":"user added to manager group"}, 200)
     
     def destroy(self, request):
         user = get_object_or_404(user, username = request.data['username'])
         managers = Group.objects.get(name='manager')
         managers.user_set.remove(user)
         return Response({"message":"user removed from manager group"}, 200)
         
class DeliveryCrewViewSet(viewsets.ViewSet):
     throttle_classes = [UserRateThrottle]
     permission_classes = [IsAuthenticated, IsAdminOrManagerPermission]
     serializer_class = OrderSerializer

     def get_queryset(self):
         users = User.objects.all().filter(groups__name="delivery crew")
         items = UserSerializer(users, many=True)
         return Response(items.data)
     
     
     def create(self, request):
         #only for admins and Managers
         if self.request.is_superuser == False:
             if self.request.user.groups.filter(name='manager').exists() == False:
                 return Response({"message":"Forbidden"}, status.HTTP_403_FORBIDDEN)
             
         user = get_object_or_404(user, username = request.data['username'])
         delivery_crew = Group.objects.get(name='delivery crew')
         delivery_crew.user_set.add(user)
         return Response({"message":"user added to delivery crew group"}, 200)
       
     
     def destroy(self, request, user_id): #Only admins and managers can delete or remove users from groups
         if self.request.is_superuser == False:
             if self.request.user.groups.filter(name='manager').exists() == False:
                 return Response({"message":"Forbidden"}, status.HTTP_403_FORBIDDEN)
             
         user = get_object_or_404(user, username = request.data['username'])
         delivery_crew = Group.objects.get(name='delivery crew')
         delivery_crew.user_set.remove(user)
         return Response({"message":"user removed from delivery crew group"}, 200)

class OrdersView(generics.RetrieveUpdateDestroyAPIView, generics.ListCreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
           return Order.objects.all()
        elif self.request.user.groups.count() ==0:#normal customer- no group
            return Order.objects.all().filter(user=self.request.user)
        elif self.request.user.groups.filter(name='delivery crew').exists():
            return Order.objects.all().filter(delivery_crew=self.request.user)
        else:#delivery crew or manager
            return Order.objects.all()
        
    def create(self, request, *args, **kwargs):
        menuitem_count = Cart.objects.all().filter(user=self.request.user).count()
        if menuitem_count == 0:
            return Response({"message": " Cart is empty"})
        #current_user = request.user
        #cart_items = Cart.objects.filter(user=current_user)
        data = request.data.copy()
        total= self.get_total_price(self.request.user)
        data['total'] = total
        data['user'] = self.request.user.id
        data['date'] = timezone.now() #sets date to current time and day
        order_serializer = OrderSerializer(data=data)

        if order_serializer.is_valid():
            order = order_serializer.save()

            items = Cart.objects.all().filter(user=self.request.user).all()

            for item in items.values():
                orderitem = OrderItems(
                    order=order,
                    menu_items_id= item['menu_items_id'],
                    price=item['price'],
                    quantity=item['quantity'],
                )
                orderitem.save()

            Cart.objects.all().filter(user=self.request.user).delete()#deletes the cart items
                
            result = order_serializer.data.copy()
            result['total'] = total
            return Response(order_serializer.data)
            
        return Response(order_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    def get_total_price(self, user):
        total = 0
        items = Cart.objects.all().filter(user=user).all()
        for item in items.values():
            total += item['price']
        return total
class SingleOrdersView(generics.RetrieveUpdateAPIView):
            queryset = Order.objects.all()
            serializer_class=OrderSerializer
            permission_classes = [IsAuthenticated]
             
            def get_throttles(self):
                if self.action == 'update':
                    throttle_classes = [OneCallPerMinute]
                else:
                    throttle_classes=[]
                return [throttle() for throttle in throttle_classes]
                     
            def update(self, request, *args, **kwargs):
                if self.request.user.groups.count()==0: #normal user(customer)
                    return Response("Access denied")
                else:#anyone else(Admin, manager or delivery crew)
                    return super().update(request, *args, **kwargs)               
    
    
