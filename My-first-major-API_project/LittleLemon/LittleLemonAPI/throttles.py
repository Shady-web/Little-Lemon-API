from rest_framework.throttling import UserRateThrottle

class OneCallPerMinute(UserRateThrottle):
    scope = 'one'