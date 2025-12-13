"""
Test script for handwriting recognition setup
Executes the steps you requested for dataset loading and inspection
"""

import sys
import os

# Add the backend directory to Python path
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_path)

def main():
    """Execute the handwriting recognition setup steps"""
    
    print("🚀 Starting Handwriting Recognition Setup")
    print("="*50)
    
    try:
        # Import the service
        from app.services.handwriting_recognition_service import handwriting_service
        
        # Step 1: Check dependencies
        print("📋 Step 1: Checking dependencies...")
        deps = handwriting_service.check_dependencies()
        
        for dep, available in deps.items():
            status = "✅" if available else "❌"
            print(f"{status} {dep}: {'Available' if available else 'Missing'}")
        
        missing_deps = [dep for dep, available in deps.items() if not available]
        if missing_deps:
            print(f"\n⚠️  Missing dependencies: {', '.join(missing_deps)}")
            print("Please install them with:")
            print("pip install datasets matplotlib torch transformers pillow")
            return
        
        print("\n🔄 All dependencies available!")
        
        # Step 2: Load IAM dataset
        print("\n📊 Step 2: Loading IAM dataset...")
        if handwriting_service.load_iam_dataset():
            
            # Step 3: Inspect dataset
            print("\n🔍 Step 3: Inspecting dataset structure...")
            dataset_info = handwriting_service.inspect_dataset()
            
            # Step 4: Visualize samples
            print("\n🖼️ Step 4: Visualizing samples...")
            if handwriting_service.visualize_samples(num_samples=3):
                print("✅ Sample visualization complete!")
            
            # Step 5: Preprocess a small batch
            print("\n🔧 Step 5: Preprocessing sample images...")
            preprocessed = handwriting_service.preprocess_images(max_samples=10)
            print(f"✅ Preprocessed {len(preprocessed)} samples")
            
            print("\n🎉 Setup completed successfully!")
            print("\nNext steps:")
            print("1. Choose a model: handwriting_service.load_trocr_model() or load_donut_model()")
            print("2. Process handwritten images: handwriting_service.process_handwritten_exam(image)")
            
        else:
            print("❌ Failed to load dataset")
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running this from the backend directory")
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")

if __name__ == "__main__":
    main()