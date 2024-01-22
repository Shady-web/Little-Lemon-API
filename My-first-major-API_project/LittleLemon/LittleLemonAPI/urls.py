from django.urls import path
from . import views

urlpatterns = [
    path('categories', views.CategoriesView.as_view()),
    #path('category/<int:pk>/', views.CategoriesView.as_view(), name= 'category-detail'),
    path('menu-items/', views.MenuItemsView.as_view()),
    path('menu-items/<int:pk>/', views.SingleMenuItemView.as_view()),
    path('cart/menu-items', views.CartView.as_view()),
    path('groups/manager/users', views.ManagerViewSet.as_view({'get': 'list', 'post': 'create', 'delete': 'destroy'})),
    #path('groups/manager/users/<int:user_id>/', views.ManagerView.as_view()),
    path('groups/delivery-crew/users', views.DeliveryCrewViewSet.as_view({'get': 'list', 'post': 'create', 'delete': 'destroy'})),
    #path('groups/delivery-crew/users/<int:id>/', views.DeliveryCrewView.as_view()),
    #path('orders', views.DeliveryCrewView.as_view(), name='delivery-crew'),
    #path('orders', views.DeliveryCrewOrdersView.as_view()),
    #path('orders/<int:pk>/',views.DeliveryCrewOrdersView.as_view()),
    path('orders', views.OrdersView.as_view()),
    path('orders/<int:pk>/', views.SingleOrdersView.as_view()),
    #path('orders', views.ManagerOrdersView.as_view()),
    #path('orders/<int:pk>/', views.ManagerOrdersView.as_view()),
]