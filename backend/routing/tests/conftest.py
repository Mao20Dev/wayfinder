import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-key-never-use-for-a-deployment")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
