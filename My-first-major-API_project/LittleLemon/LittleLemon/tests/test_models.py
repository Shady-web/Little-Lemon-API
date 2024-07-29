from django.test import TestCase
from LittleLemonAPI.models import MenuItems, Cart, OrderItems, Category, Order
from django.contrib.auth.models import User

class MenuItemsTest(TestCase):
    def test_get_items(self):
        category = Category.objects.create(slug='Dessert', title='Dessert')
        item = MenuItems.objects.create(title="IceCream", price=80, featured= False, inventory=100, category=category)
        self.assertEqual(str(item), "IceCream:80")

class CartTest(TestCase):
    def test_get_items(self):
        user = User.objects.create(username='testuser')
        category = Category.objects.create(slug="dessert", title="Dessert")
        menu_item = MenuItems.objects.create(title="IceCream", price=40, featured=False, inventory=100, category=category)
        cart_item = Cart.objects.create(menu_items=menu_item, quantity=2, unit_price=40, price=80, user=user)
        self.assertEqual(str(cart_item), "IceCream:80")

class OrderTest(TestCase):
    def test_create_order(self):
        user = User.objects.create(username="testuser")
        order = Order.objects.create(user=user, status=True, total=100.00, date="2024-01-01T12:00:00Z")
        self.assertEqual(str(order), f"order placed by {order.user.username}")
        

class OrderItemsTest(TestCase):
    def test_create_order_item(self):
        user = User.objects.create(username='testuser')
        category = Category.objects.create(slug="dessert", title="Dessert")
        order = Order.objects.create(user=user, status=True, total=100.00, date="2024-01-01T12:00:00Z")
        menu_item = MenuItems.objects.create(title="IceCream", price=40, featured=False, inventory=100, category=category)
        order_item = OrderItems.objects.create(order=order, menu_items=menu_item, quantity=2, price=80)
 
        self.assertEqual(order_item.order, order)
        self.assertEqual(order_item.menu_items, menu_item)
        self.assertEqual(order_item.quantity, 2)
        self.assertEqual(order_item.price, 80)

    