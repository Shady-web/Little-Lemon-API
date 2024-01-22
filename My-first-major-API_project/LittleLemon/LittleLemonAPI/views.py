from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.response import Response
from .models import MenuItems, Category, Cart, OrderItems, Order
from .serializers import MenuItemsSerializer, CategorySerializer, CartSerializer, UserSerializer, OrderSerializer
from .serializers import OrderSerializer 
from rest_framework.decorators import  throttle_classes
from django.contrib.auth.models import Group
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdminOrManagerPermission
from rest_framework import viewsets
from django.utils import timezone
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from .throttles import OneCallPerMinute
# Create your views here.

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
    queryset = MenuItems.objects.all()
    serializer_class = MenuItemsSerializer
    ordering_fields = ['price', 'inventory']
    search_fields = ['category__title']

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
            
        #return Response(order_serializer.errors, status.HTTP_400_BAD_REQUEST)
            
    def get_total_price(self, user): #calculates the total price for the order
        total = 0
        items = Cart.objects.all().filter(user=user).all()
        for item in items.values():
            total += item['price']   
            return total 
        
        #return Response({"message":"Orders created successfully and items in cart has been deleted"}, status=status.HTTP_201_CREATED)
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
    
    
