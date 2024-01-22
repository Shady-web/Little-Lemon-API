from django.db import models
from django.contrib.auth.models import User
# Create your models here.

class Category(models.Model):
    slug = models.SlugField()
    title = models.CharField(max_length=255, db_index = True)

class MenuItems(models.Model):
    title = models.CharField(max_length=255, db_index = True)
    price = models.DecimalField(max_digits = 6, decimal_places = 2, db_index= True)
    featured = models.BooleanField(db_index= True)
    inventory = models.SmallIntegerField()
    category = models.ForeignKey(Category, on_delete= models.PROTECT)    

class Cart(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)   
    menu_items = models.ForeignKey(MenuItems, on_delete= models.CASCADE)
    quantity = models.SmallIntegerField()
    unit_price = models.DecimalField(max_digits = 6, decimal_places=2)
    price = models.DecimalField(max_digits=6, decimal_places=2)

    class Meta:
        unique_together = ('menu_items', 'user')

class Order(models.Model):
    user = models.ForeignKey(User, on_delete = models.CASCADE)
    delivery_crew = models.ForeignKey(User, on_delete = models.SET_NULL, related_name = "delivery_crew", null = True)
    status = models.BooleanField(db_index = True, default = 0)
    total = models.DecimalField(max_digits = 6, decimal_places = 2)
    date = models.DateTimeField(db_index = True)
    #def __str__(self) -> str:
        #return "order placed by" + self.user.username
class OrderItems(models.Model):
    order = models.ForeignKey(Order, on_delete = models.CASCADE, related_name = 'order_items')
    menu_items = models.ForeignKey(MenuItems, on_delete =models.CASCADE)
    quantity = models.SmallIntegerField()
    price = models.DecimalField(max_digits = 6, decimal_places=2)    
    
    class Meta:
        unique_together = ('order', 'menu_items')
