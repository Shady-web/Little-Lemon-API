import os
import sys
import shutil

# Locate the Django project relative to this file
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
django_project = os.path.join(repo_root, 'My-first-major-API_project', 'LittleLemon')
sys.path.insert(0, django_project)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'LittleLemon.settings')
os.environ.setdefault('VERCEL', '1')

# SQLite is read-only in the Vercel Lambda — copy it to /tmp so writes work.
db_source = os.path.join(django_project, 'db.sqlite3')
db_dest = '/tmp/db.sqlite3'
if os.path.exists(db_source) and not os.path.exists(db_dest):
    shutil.copy2(db_source, db_dest)

from django.core.wsgi import get_wsgi_application
app = get_wsgi_application()
