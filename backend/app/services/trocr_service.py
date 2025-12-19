"""
TrOCR Service for Handwriting Recognition
Uses microsoft/trocr-large-handwritten for OCR on images
"""

import io
from typing import Optional, List, Tuple
from PIL import Image

# Import with fallbacks for ML libraries
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

try:
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TrOCRProcessor = None
    VisionEncoderDecoderModel = None
    TRANSFORMERS_AVAILABLE = False


class TrOCRService:
    """Service for extracting text from images using TrOCR"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern to avoid loading model multiple times"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if TrOCRService._initialized:
            return
            
        self.model = None
        self.processor = None
        self.device = None
        # Using base model - smaller (335MB) and faster to download
        # Still excellent for handwriting recognition
        self.model_name = "microsoft/trocr-base-handwritten"
        self._load_error = None
        
        TrOCRService._initialized = True
    
    def is_available(self) -> bool:
        """Check if TrOCR dependencies are available"""
        return TORCH_AVAILABLE and TRANSFORMERS_AVAILABLE
    
    def get_status(self) -> dict:
        """Get service status"""
        return {
            "available": self.is_available(),
            "torch_available": TORCH_AVAILABLE,
            "transformers_available": TRANSFORMERS_AVAILABLE,
            "model_loaded": self.model is not None,
            "model_name": self.model_name,
            "device": str(self.device) if self.device else None,
            "load_error": self._load_error
        }
    
    def load_model(self) -> bool:
        """Load the TrOCR model (lazy loading)"""
        if self.model is not None:
            return True
        
        if not self.is_available():
            self._load_error = "TrOCR dependencies not available (torch or transformers missing)"
            return False
        
        try:
            print(f"Loading TrOCR model: {self.model_name}...")
            
            # Load processor and model
            self.processor = TrOCRProcessor.from_pretrained(self.model_name)
            self.model = VisionEncoderDecoderModel.from_pretrained(self.model_name)
            
            # Set device
            if torch.cuda.is_available():
                self.device = torch.device("cuda")
            else:
                self.device = torch.device("cpu")
            
            self.model.to(self.device)
            self.model.eval()
            
            print(f"TrOCR model loaded successfully on {self.device}")
            self._load_error = None
            return True
            
        except Exception as e:
            self._load_error = str(e)
            print(f"Failed to load TrOCR model: {e}")
            return False
    
    def extract_text_from_image(self, image: Image.Image) -> str:
        """
        Extract text from a PIL Image using TrOCR
        
        Args:
            image: PIL Image object
            
        Returns:
            Extracted text string
        """
        if not self.load_model():
            raise RuntimeError(f"TrOCR model not available: {self._load_error}")
        
        try:
            # Ensure RGB mode
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Process image
            pixel_values = self.processor(
                images=image, 
                return_tensors="pt"
            ).pixel_values.to(self.device)
            
            # Generate text
            with torch.no_grad():
                generated_ids = self.model.generate(
                    pixel_values,
                    max_length=256,
                    num_beams=4,
                    early_stopping=True
                )
            
            # Decode
            text = self.processor.batch_decode(
                generated_ids, 
                skip_special_tokens=True
            )[0]
            
            return text.strip()
            
        except Exception as e:
            raise RuntimeError(f"TrOCR extraction failed: {e}")
    
    def extract_text_from_bytes(self, image_bytes: bytes) -> str:
        """
        Extract text from image bytes
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Extracted text string
        """
        image = Image.open(io.BytesIO(image_bytes))
        return self.extract_text_from_image(image)
    
    def extract_text_from_image_lines(
        self, 
        image: Image.Image,
        line_height_ratio: float = 0.1,
        min_line_height: int = 30
    ) -> str:
        """
        Extract text from an image by splitting it into horizontal lines.
        This works better for multi-line handwritten documents.
        
        Args:
            image: PIL Image object
            line_height_ratio: Approximate ratio of line height to image height
            min_line_height: Minimum height for a line segment in pixels
            
        Returns:
            Extracted text with newlines
        """
        if not self.load_model():
            raise RuntimeError(f"TrOCR model not available: {self._load_error}")
        
        try:
            # Ensure RGB mode
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            width, height = image.size
            
            # Calculate line height
            estimated_line_height = max(
                int(height * line_height_ratio),
                min_line_height
            )
            
            # If image is small enough, process as single image
            if height <= estimated_line_height * 2:
                return self.extract_text_from_image(image)
            
            # Split into lines and process each
            lines = []
            y = 0
            
            while y < height:
                # Calculate line boundaries
                y_end = min(y + estimated_line_height, height)
                
                # Crop line
                line_image = image.crop((0, y, width, y_end))
                
                # Skip very thin lines
                if line_image.size[1] < min_line_height // 2:
                    y = y_end
                    continue
                
                # Extract text from line
                try:
                    line_text = self.extract_text_from_image(line_image)
                    if line_text.strip():
                        lines.append(line_text.strip())
                except Exception:
                    pass  # Skip failed lines
                
                y = y_end
            
            return "\n".join(lines)
            
        except Exception as e:
            # Fallback to single image processing
            return self.extract_text_from_image(image)
    
    def extract_text_from_regions(
        self, 
        image: Image.Image,
        regions: List[Tuple[int, int, int, int]]
    ) -> List[str]:
        """
        Extract text from specific regions of an image.
        
        Args:
            image: PIL Image object
            regions: List of (x1, y1, x2, y2) bounding boxes
            
        Returns:
            List of extracted text strings, one per region
        """
        if not self.load_model():
            raise RuntimeError(f"TrOCR model not available: {self._load_error}")
        
        results = []
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        for region in regions:
            try:
                x1, y1, x2, y2 = region
                cropped = image.crop((x1, y1, x2, y2))
                text = self.extract_text_from_image(cropped)
                results.append(text)
            except Exception as e:
                results.append(f"[Error: {e}]")
        
        return results


# Singleton instance
trocr_service = TrOCRService()
