import os
import sys

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
django_project = os.path.join(repo_root, 'My-first-major-API_project', 'LittleLemon')
sys.path.insert(0, django_project)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'LittleLemon.settings')
os.environ.setdefault('VERCEL', '1')

db_dest = '/tmp/db.sqlite3'
is_fresh_db = not os.path.exists(db_dest)

if is_fresh_db:
    import django
    django.setup()
    from django.core.management import call_command
    call_command('migrate', '--run-syncdb', verbosity=0)
    try:
        from LittleLemonAPI.models import MenuItems
        if not MenuItems.objects.exists():
            call_command('loaddata', 'initial_data', verbosity=0)
    except Exception as e:
        print(f"[init] fixture load failed: {e}")

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
