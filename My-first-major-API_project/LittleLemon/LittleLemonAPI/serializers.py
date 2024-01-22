from rest_framework import serializers
from .models import MenuItems, Category, Cart, Order, OrderItems
from django.contrib.auth.models import User

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

class MenuItemsSerializer(serializers.ModelSerializer):
    category_id = serializers.IntegerField(write_only = True)
    #category= serializers.PrimaryKeyRelatedField(queryset= Category.objects.all())
    category = CategorySerializer(read_only = True)
    class Meta:
        model = MenuItems
        fields = ['id', 'title', 'price','featured', 'inventory', 'category', 'category_id']

class CartSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(),
                                              default=serializers.CurrentUserDefault(),)
    
    def validate(self, attrs):
        attrs['price'] = attrs['quantity'] * attrs['unit_price']
        return attrs
    
    class Meta:
        model = Cart
        fields = ['user', 'menu_items', 'quantity', 'unit_price', 'price']   
        extra_kwargs = {
            'price': {'read_only': True}
        }  

class UserSerializer(serializers.ModelSerializer):
    class Meta: 
        model = User
        fields = ['id', 'username', 'email']      

class OrderItemsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItems
        fields = ['menu_items', 'quantity', 'price']             

class OrderSerializer(serializers.ModelSerializer):
    order_items = OrderItemsSerializer(many = True, read_only=True, source='order')
    date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M")
    class Meta:
        model = Order
        fields = ['id', 'user', 'order_items', 'delivery_crew', 'status', 'total', 'date']

        def create(self, validated_data):
            order_items_data = validated_data.pop('order_items', [])
            total = sum(item_data['price'] for item_data in order_items_data)
            order = Order.objects.create(total=total, **validated_data)
            for item_data in order_items_data:
                Order.objects.create(order=order, **item_data)

            return order
