from supabase import create_client, Client
from app.core.config import settings

# Create Supabase client (anon key - subject to RLS)
supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

# Create admin client with service role key if available (bypasses RLS)
supabase_admin: Client = None
if settings.supabase_service_role_key:
    supabase_admin = create_client(settings.supabase_url, settings.supabase_service_role_key)

# db alias for database_service.py - use admin client (bypasses RLS) if available, otherwise fall back to anon
db: Client = supabase_admin if supabase_admin else supabase