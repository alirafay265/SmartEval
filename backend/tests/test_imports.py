import traceback
import sys

try:
    print("Testing main import...")
    import main
    print("SUCCESS: Main imported successfully!")
    
    print("Testing app startup...")
    app = main.app
    print("SUCCESS: App created successfully!")
    
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()