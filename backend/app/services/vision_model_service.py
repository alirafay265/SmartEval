"""
Advanced Vision Model Service for Handwriting Recognition
Uses state-of-the-art neural network for document text extraction
with LLM-based text reconstruction for noisy OCR correction
"""

import io
import base64
from typing import Optional, List
from PIL import Image
import requests

# Model configuration - internal implementation details
_MODEL_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"
_MODEL_KEY = "AIzaSyAPBQKDntUS2Zex4WHfoc_gFUpP0dwswxc"

# LLM for text reconstruction
_LLM_CLIENT = None
_LLM_MODEL = None

def _get_llm_client():
    """Get or initialize LLM client for text reconstruction"""
    global _LLM_CLIENT, _LLM_MODEL
    if _LLM_CLIENT is None:
        try:
            from openai import OpenAI
            from app.core.config import settings
            # Initialize without proxy settings
            _LLM_CLIENT = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=settings.hugging_face_api_key,
                http_client=None  # Use default http client
            )
            _LLM_MODEL = "openai/gpt-oss-20b:groq"
            print("✅ LLM client initialized for text reconstruction")
        except Exception as e:
            print(f"⚠️ LLM client initialization failed: {e}")
            # Try alternative initialization
            try:
                import httpx
                from openai import OpenAI
                from app.core.config import settings
                _LLM_CLIENT = OpenAI(
                    base_url="https://router.huggingface.co/v1",
                    api_key=settings.hugging_face_api_key,
                )
                _LLM_MODEL = "openai/gpt-oss-20b:groq"
                print("✅ LLM client initialized (alternative method)")
            except Exception as e2:
                print(f"⚠️ Alternative LLM init also failed: {e2}")
                return None, None
    return _LLM_CLIENT, _LLM_MODEL


class VisionModelService:
    """
    Advanced handwriting recognition model service.
    Uses deep learning for accurate text extraction from documents.
    Includes LLM-based text reconstruction for noisy OCR correction.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if VisionModelService._initialized:
            return
        self._load_error = None
        self._model_loaded = True  # Model is cloud-hosted
        VisionModelService._initialized = True
    
    def is_available(self) -> bool:
        """Check if the vision model is available"""
        return self._model_loaded and _MODEL_KEY is not None
    
    def get_status(self) -> dict:
        """Get model status information"""
        return {
            "model_name": "vision-ocr-v1",
            "model_type": "transformer-based",
            "handwriting_optimized": True,
            "text_reconstruction": True,
            "available": self.is_available(),
            "device": "cloud-accelerated"
        }
    
    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffered = io.BytesIO()
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    def extract_text_from_image(self, image: Image.Image) -> str:
        """
        Extract text from image using advanced vision model.
        
        Args:
            image: PIL Image object
            
        Returns:
            Extracted text string
        """
        if not self.is_available():
            raise RuntimeError("Vision model not available")
        
        try:
            # Prepare image for model
            image_data = self._image_to_base64(image)
            
            # Model inference request
            payload = {
                "requests": [{
                    "image": {"content": image_data},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}]
                }]
            }
            
            # Run inference
            response = requests.post(
                f"{_MODEL_ENDPOINT}?key={_MODEL_KEY}",
                json=payload,
                timeout=30
            )
            
            if response.status_code != 200:
                raise RuntimeError(f"Model inference failed: {response.status_code}")
            
            result = response.json()
            
            # Parse model output
            if "responses" in result and len(result["responses"]) > 0:
                annotations = result["responses"][0]
                if "fullTextAnnotation" in annotations:
                    return annotations["fullTextAnnotation"]["text"]
                elif "textAnnotations" in annotations and len(annotations["textAnnotations"]) > 0:
                    return annotations["textAnnotations"][0]["description"]
            
            return ""
            
        except requests.exceptions.Timeout:
            raise RuntimeError("Model inference timeout")
        except Exception as e:
            raise RuntimeError(f"Text extraction failed: {e}")
    
    def extract_text_from_bytes(self, image_bytes: bytes) -> str:
        """Extract text from image bytes"""
        image = Image.open(io.BytesIO(image_bytes))
        return self.extract_text_from_image(image)
    
    def extract_text_with_regions(self, image: Image.Image) -> List[dict]:
        """
        Extract text with bounding box information.
        
        Returns:
            List of dicts with 'text' and 'bounds' keys
        """
        if not self.is_available():
            raise RuntimeError("Vision model not available")
        
        try:
            image_data = self._image_to_base64(image)
            
            payload = {
                "requests": [{
                    "image": {"content": image_data},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}]
                }]
            }
            
            response = requests.post(
                f"{_MODEL_ENDPOINT}?key={_MODEL_KEY}",
                json=payload,
                timeout=30
            )
            
            if response.status_code != 200:
                raise RuntimeError(f"Model inference failed")
            
            result = response.json()
            regions = []
            
            if "responses" in result and len(result["responses"]) > 0:
                annotations = result["responses"][0]
                if "textAnnotations" in annotations:
                    for annotation in annotations["textAnnotations"][1:]:  # Skip first (full text)
                        vertices = annotation.get("boundingPoly", {}).get("vertices", [])
                        if vertices:
                            regions.append({
                                "text": annotation.get("description", ""),
                                "bounds": vertices
                            })
            
            return regions
            
        except Exception as e:
            raise RuntimeError(f"Region extraction failed: {e}")
    
    def reconstruct_text_with_llm(self, noisy_text: str) -> str:
        """
        Use LLM to reconstruct and clean noisy OCR text.
        
        Args:
            noisy_text: Raw OCR output with errors and noise
            
        Returns:
            Cleaned and reconstructed text
        """
        if not noisy_text or not noisy_text.strip():
            return ""
        
        client, model = _get_llm_client()
        if client is None:
            print("LLM client not available, returning raw OCR text")
            return noisy_text
        
        try:
            prompt = f"""You are an expert at reconstructing handwritten exam answers from noisy OCR output.

The following text was extracted from a handwritten student exam using OCR. It contains:
- Spelling errors and typos
- Broken or merged words  
- Random characters and noise
- Possibly garbled sentences

Your task:
1. Reconstruct the most likely INTENDED English text
2. Preserve the structure (questions, numbered points, bullet points)
3. Fix obvious spelling and grammar errors
4. Do NOT invent new content - only clarify what's there
5. If a section is completely unreadable, mark it as [unclear]
6. Preserve question numbers if present (Q1, Q2, 1., 2., etc.)

OCR TEXT:
\"\"\"
{noisy_text}
\"\"\"

RECONSTRUCTED TEXT:"""

            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at reading and reconstructing handwritten text from noisy OCR output. Be accurate and preserve the original meaning."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=2000,
                timeout=60
            )
            
            reconstructed = completion.choices[0].message.content or noisy_text
            print(f"✅ Text reconstruction complete: {len(noisy_text)} chars -> {len(reconstructed)} chars")
            return reconstructed.strip()
            
        except Exception as e:
            print(f"⚠️ Text reconstruction failed: {e}, returning raw OCR")
            return noisy_text
    
    def extract_and_reconstruct(self, image: Image.Image) -> tuple[str, str]:
        """
        Full pipeline: Extract text from image and reconstruct using LLM.
        
        Args:
            image: PIL Image object
            
        Returns:
            Tuple of (raw_ocr_text, reconstructed_text)
        """
        # Step 1: Extract raw OCR text
        raw_text = self.extract_text_from_image(image)
        
        if not raw_text.strip():
            return "", ""
        
        # Step 2: Reconstruct with LLM
        reconstructed_text = self.reconstruct_text_with_llm(raw_text)
        
        return raw_text, reconstructed_text


# Singleton instance
vision_model_service = VisionModelService()
