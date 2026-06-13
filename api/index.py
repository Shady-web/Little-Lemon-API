import os
import sys

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
django_project = os.path.join(repo_root, 'My-first-major-API_project', 'LittleLemon')
sys.path.insert(0, django_project)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'LittleLemon.settings')
os.environ.setdefault('VERCEL', '1')

_bootstrapped = False

def _bootstrap():
    global _bootstrapped
    if _bootstrapped:
        return
    _bootstrapped = True

    import django
    django.setup()
    from django.core.management import call_command

    use_postgres = bool(os.environ.get('DATABASE_URL'))
    sqlite_path  = '/tmp/db.sqlite3'
    fresh_sqlite = not use_postgres and not os.path.exists(sqlite_path)

    # Migrate for PostgreSQL (idempotent) or on a fresh SQLite instance
    if use_postgres or fresh_sqlite:
        call_command('migrate', verbosity=0)
        try:
            from LittleLemonAPI.models import MenuItems
            if not MenuItems.objects.exists():
                call_command('loaddata', 'initial_data', verbosity=0)
        except Exception as e:
            print(f"[init] seed failed: {e}")

_bootstrap()

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
