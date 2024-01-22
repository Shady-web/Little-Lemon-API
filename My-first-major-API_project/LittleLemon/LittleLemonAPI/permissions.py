from rest_framework.permissions import BasePermission

class IsAdminOrManagerPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.groups.filter(name='manager').exists()) 
    
class IsDeliveryCrewPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user and (request.user.groups.filter(name='delivery crew').exists()) 