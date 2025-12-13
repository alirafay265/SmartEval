"""
Handwriting Recognition Service for Processing Handwritten Exams
Uses IAM dataset with Donut/TrOCR for handwritten text recognition
"""

import io
import os
from typing import Optional, List, Dict, Any, Union
import numpy as np
from PIL import Image

                # Type aliases for dataset handling
DatasetType = Union[object, List, Dict]
SampleType = Union[Dict[str, Any], object]

# Add type ignores for dynamic ML library imports to suppress type errors
# pyright: reportMissingImports=false
# pyright: reportUnknownMemberType=false
# Import with fallbacks for ML libraries
try:
    from datasets import load_dataset
except ImportError:
    load_dataset = None
except Exception:
    load_dataset = None

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None
except Exception:
    plt = None

try:
    import torch
    from transformers import (
        DonutProcessor, VisionEncoderDecoderModel,
        TrOCRProcessor, VisionEncoderDecoderModel as TrOCRModel
    )
except ImportError:
    torch = None
    DonutProcessor = None
    VisionEncoderDecoderModel = None
    TrOCRProcessor = None
    TrOCRModel = None
except Exception:
    # Handle numpy conflicts and other import issues
    torch = None
    DonutProcessor = None
    VisionEncoderDecoderModel = None
    TrOCRProcessor = None
    TrOCRModel = None

def safe_len(obj: Any) -> int:
    """Safely get length of an object"""
    try:
        return len(obj) if hasattr(obj, '__len__') else 0
    except (TypeError, AttributeError):
        return 0

def safe_getitem(obj: Any, key: Union[int, str]) -> Any:
    """Safely get item from object"""
    try:
        if hasattr(obj, '__getitem__'):
            return obj[key]
        elif hasattr(obj, str(key)):
            return getattr(obj, str(key))
    except (KeyError, IndexError, AttributeError, TypeError):
        pass
    return None

def safe_get_attr(obj: Any, attr: str, default: Any = None) -> Any:
    """Safely get attribute from object"""
    try:
        if hasattr(obj, attr):
            return getattr(obj, attr, default)
    except (AttributeError, TypeError):
        pass
    return default

class HandwritingRecognitionService:
    def __init__(self):
        """Initialize the handwriting recognition service"""
        self.dataset = None
        self.model = None
        self.processor = None
        self.model_type = None  # 'donut' or 'trocr'
        
    def check_dependencies(self) -> Dict[str, bool]:
        """Check if required ML dependencies are available"""
        return {
            "datasets": load_dataset is not None,
            "matplotlib": plt is not None,
            "torch": torch is not None,
            "transformers": DonutProcessor is not None,
        }
    
    def load_iam_dataset(self) -> bool:
        """Load the IAM handwriting dataset"""
        try:
            if not load_dataset:
                raise Exception("datasets library not available. Please install: pip install datasets")
            
            print("🔄 Loading IAM processed dataset...")
            self.dataset = load_dataset("mukatirohit/IAM-processed-dataset")
            print("✅ Dataset loaded successfully!")
            
            return True
            
        except Exception as e:
            print(f"❌ Error loading dataset: {e}")
            return False
    
    def inspect_dataset(self) -> Dict[str, Any]:
        """Inspect the loaded dataset structure"""
        if not self.dataset:
            raise Exception("Dataset not loaded. Call load_iam_dataset() first.")
        
        try:
            print("📊 Dataset Structure:")
            print(self.dataset)
            print("\n" + "="*50)
            
            # Get sample data safely
            train_dataset = safe_getitem(self.dataset, "train")
            sample = None
            sample_keys = []
            
            if train_dataset is not None:
                dataset_len = safe_len(train_dataset)
                
                if dataset_len > 0:
                    sample = safe_getitem(train_dataset, 0)
                    if sample is None:
                        print("⚠️ Could not access first sample")
            if sample is not None:
                print("📝 Sample Data Structure:")
                
                # Try to get keys safely
                try:
                    if hasattr(sample, 'keys') and callable(getattr(sample, 'keys')):
                        sample_keys = list(sample.keys())
                    elif isinstance(sample, dict):
                        sample_keys = list(sample.keys())
                    else:
                        # Infer common keys
                        sample_keys = []
                        if safe_get_attr(sample, 'image') is not None or safe_getitem(sample, 'image') is not None:
                            sample_keys.append('image')
                        if safe_get_attr(sample, 'text') is not None or safe_getitem(sample, 'text') is not None:
                            sample_keys.append('text')
                        if not sample_keys:
                            sample_keys = ["image", "text"]  # Default expected keys
                    
                    print(f"Keys: {sample_keys}")
                    
                    # Print sample content safely
                    print("\n📖 First Sample:")
                    for key in sample_keys:
                        value = safe_getitem(sample, key) or safe_get_attr(sample, key)
                        if key == 'image' and value is not None and hasattr(value, 'size'):
                            try:
                                print(f"{key}: <PIL.Image object> - Size: {value.size}")
                            except AttributeError:
                                print(f"{key}: <Image object>")
                        else:
                            print(f"{key}: {str(value)[:100]}{'...' if len(str(value)) > 100 else ''}")
                            
                except Exception as sample_error:
                    print(f"⚠️ Error processing sample: {sample_error}")
                    sample_keys = ["image", "text"]
                    
            # Ensure we have sample_keys defined
            if sample is None:
                sample_keys = []
                sample = {}
            
            # Calculate total samples safely
            train_ds = safe_getitem(self.dataset, "train")
            total_samples = safe_len(train_ds) if train_ds is not None else 0
            
            # Get dataset splits safely
            splits = ["train"]
            try:
                if isinstance(self.dataset, dict):
                    splits = list(self.dataset.keys())
                elif hasattr(self.dataset, '__dict__') and hasattr(self.dataset, '__iter__'):
                    # For dataset objects, try to get available splits
                    try:
                        # Common dataset splits
                        possible_splits = ['train', 'validation', 'test']
                        splits = []
                        for split in possible_splits:
                            if safe_getitem(self.dataset, split) is not None:
                                splits.append(split)
                        if not splits:
                            splits = ["train"]
                    except Exception:
                        splits = ["train"]
            except Exception:
                splits = ["train"]
            
            return {
                "total_samples": total_samples,
                "splits": splits,
                "sample_keys": sample_keys,
                "sample_data": sample
            }
            
        except Exception as e:
            print(f"❌ Error inspecting dataset: {e}")
            return {}
    
    def visualize_samples(self, num_samples: int = 3) -> bool:
        """Visualize sample images from the dataset"""
        if not self.dataset:
            raise Exception("Dataset not loaded. Call load_iam_dataset() first.")
        
        if not plt:
            print("❌ matplotlib not available. Please install: pip install matplotlib")
            return False
        
        try:
            print(f"🖼️ Visualizing {num_samples} samples...")
            
            fig, axes = plt.subplots(1, num_samples, figsize=(15, 5))
            if num_samples == 1:
                axes = [axes]
            
            train_dataset = safe_getitem(self.dataset, "train")
            if train_dataset is None:
                print("⚠️ No train dataset found")
                return False
            
            # Calculate safe iteration range
            dataset_len = safe_len(train_dataset)
            max_range = min(num_samples, dataset_len) if dataset_len > 0 else num_samples
            
            for i in range(max_range):
                sample = safe_getitem(train_dataset, i)
                if sample is None:
                    print(f"⚠️ Could not access sample {i}")
                    continue
                
                try:
                    # Handle different sample formats safely
                    img = safe_getitem(sample, "image") or safe_get_attr(sample, 'image')
                    text = safe_getitem(sample, "text") or safe_get_attr(sample, 'text', "No text available")
                    
                    if img is None:
                        print(f"⚠️ No image found for sample {i}")
                        continue
                    
                    axes[i].imshow(img)
                    axes[i].axis("off")
                    axes[i].set_title(f"Sample {i+1}")
                    
                    # Print the text below
                    print(f"📝 Sample {i+1} Text: {str(text)[:100]}{'...' if len(str(text)) > 100 else ''}")
                    
                except Exception as e:
                    print(f"⚠️ Error processing sample {i}: {e}")
                    continue
            
            plt.tight_layout()
            plt.show()
            
            return True
            
        except Exception as e:
            print(f"❌ Error visualizing samples: {e}")
            return False
    
    def preprocess_images(self, max_samples: Optional[int] = None) -> List[Dict[str, Any]]:
        """Preprocess images for training"""
        if not self.dataset:
            raise Exception("Dataset not loaded. Call load_iam_dataset() first.")
        
        try:
            print("🔄 Preprocessing images...")
            
            train_data = self.dataset["train"]
            
            # Handle different dataset types safely
            selected_data = train_data
            
            # Try to use select method if available (for HuggingFace datasets)
            if max_samples:
                try:
                    # Check if it's a HuggingFace Dataset object with proper typing
                    if (hasattr(train_data, 'select') and 
                        callable(getattr(train_data, 'select')) and
                        not isinstance(train_data, (list, tuple))):
                        dataset_len = safe_len(train_data)
                        if dataset_len > 0:
                            # Type ignore for dynamic dataset types
                            selected_data = train_data.select(range(min(max_samples, dataset_len)))  # type: ignore
                except Exception:
                    # Fallback: use original data
                    pass
            
            preprocessed = []
            
            # Calculate safe iteration limit
            dataset_len = safe_len(selected_data)
            max_items = max_samples if max_samples else (dataset_len if dataset_len > 0 else 1000)
            if dataset_len > 0:
                max_items = min(max_items, dataset_len)
            
            for i in range(max_items):
                sample = safe_getitem(selected_data, i)
                if sample is None:
                    print(f"⚠️ Could not access sample {i}")
                    continue
                
                try:
                    # Extract image and text safely
                    img = safe_getitem(sample, "image") or safe_get_attr(sample, 'image')
                    text = safe_getitem(sample, "text") or safe_get_attr(sample, 'text', "")
                    
                    if img is None:
                        print(f"⚠️ No image found for sample {i}")
                        continue
                    
                    # Convert PIL image to numpy array if needed
                    if isinstance(img, Image.Image):
                        img_array = np.array(img)
                    else:
                        img_array = img
                    
                    # Ensure image is in RGB format
                    if isinstance(img_array, np.ndarray):
                        if len(img_array.shape) == 3 and img_array.shape[2] == 4:  # RGBA
                            img = Image.fromarray(img_array).convert("RGB")
                        elif len(img_array.shape) == 2:  # Grayscale
                            img = Image.fromarray(img_array).convert("RGB")
                        else:
                            img = Image.fromarray(img_array) if not isinstance(img, Image.Image) else img
                    
                    preprocessed_item = {
                        "image": img,
                        "text": str(text),
                        "index": i
                    }
                    
                    preprocessed.append(preprocessed_item)
                    
                except Exception as e:
                    print(f"⚠️ Error processing sample {i}: {e}")
                    continue
                
                if (i + 1) % 100 == 0:
                    print(f"Processed {i + 1} samples...")
            
            print(f"✅ Preprocessed {len(preprocessed)} samples")
            return preprocessed
            
        except Exception as e:
            print(f"❌ Error preprocessing images: {e}")
            return []
    
    def load_donut_model(self) -> bool:
        """Load Donut model for document understanding"""
        try:
            if not DonutProcessor or not VisionEncoderDecoderModel:
                raise Exception("transformers library not available. Please install: pip install transformers")
            
            print("🔄 Loading Donut model...")
            
            # Load pre-trained Donut model
            self.processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base")
            self.model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base")
            self.model_type = "donut"
            
            print("✅ Donut model loaded successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error loading Donut model: {e}")
            return False
    
    def load_trocr_model(self) -> bool:
        """Load TrOCR model for text recognition"""
        try:
            if not TrOCRProcessor or not TrOCRModel:
                raise Exception("transformers library not available. Please install: pip install transformers")
            
            print("🔄 Loading TrOCR model...")
            
            # Load pre-trained TrOCR model
            self.processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
            self.model = TrOCRModel.from_pretrained("microsoft/trocr-base-handwritten")
            self.model_type = "trocr"
            
            print("✅ TrOCR model loaded successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error loading TrOCR model: {e}")
            return False
    
    def recognize_handwriting(self, image: Image.Image) -> str:
        """Recognize handwriting in a single image"""
        if not self.model or not self.processor:
            raise Exception("Model not loaded. Call load_donut_model() or load_trocr_model() first.")
        
        try:
            if self.model_type == "trocr":
                # TrOCR processing
                try:
                    # Process image safely
                    inputs = None
                    
                    # Try different processor call patterns
                    for attempt in [("pt",), ("pytorch",), (None,)]:
                        try:
                            if attempt[0] is not None:
                                # Type ignore for dynamic processor parameters
                                inputs = self.processor(image, return_tensors=attempt[0])  # type: ignore
                            else:
                                inputs = self.processor(image)
                            break
                        except (TypeError, AttributeError):
                            continue
                        except Exception as proc_error:
                            print(f"Processor error with {attempt}: {proc_error}")
                            continue
                    
                    if inputs is None:
                        print("⚠️ Could not process image with any method")
                        generated_text = ""
                    
                    pixel_values = safe_get_attr(inputs, 'pixel_values') or safe_getitem(inputs, 'pixel_values') or inputs
                    
                    # Generate text using the model
                    generated_ids = None
                    
                    # Ensure pixel_values is a proper tensor
                    if torch and hasattr(torch, 'is_tensor') and not torch.is_tensor(pixel_values):
                        try:
                            pixel_values = torch.tensor(pixel_values) if torch else pixel_values
                        except Exception:
                            pass
                    
                    # Try model generation
                    if hasattr(self.model, 'generate') and callable(getattr(self.model, 'generate')):
                        try:
                            # Type ignore for dynamic model generation
                            generated_ids = self.model.generate(pixel_values)  # type: ignore
                        except Exception as gen_error:
                            print(f"Generation error: {gen_error}")
                            generated_ids = None
                    
                    if generated_ids is None:
                        # Fallback for different model types
                        try:
                            outputs = self.model(pixel_values)
                            if hasattr(outputs, 'logits'):
                                generated_ids = outputs.logits.argmax(dim=-1)
                            else:
                                generated_ids = outputs
                        except Exception as fallback_error:
                            print(f"Model inference failed: {fallback_error}")
                            generated_ids = None
                    
                    # Decode the generated text
                    if generated_ids is not None:
                        try:
                            if hasattr(self.processor, 'batch_decode'):
                                decoded = self.processor.batch_decode(generated_ids, skip_special_tokens=True)
                                generated_text = decoded[0] if decoded and len(decoded) > 0 else ""
                            elif hasattr(self.processor, 'decode'):
                                # Handle tensor indexing safely
                                if hasattr(generated_ids, '__getitem__') and len(generated_ids) > 0:
                                    generated_text = self.processor.decode(generated_ids[0], skip_special_tokens=True)
                                else:
                                    generated_text = self.processor.decode(generated_ids, skip_special_tokens=True)
                            else:
                                generated_text = str(generated_ids)
                        except Exception as decode_error:
                            print(f"Decode error: {decode_error}")
                            generated_text = ""
                    else:
                        generated_text = ""
                        
                except Exception as trocr_error:
                    print(f"TrOCR processing error: {trocr_error}")
                    generated_text = ""
                
            elif self.model_type == "donut":
                # Donut processing (more complex, document understanding)
                try:
                    # Process image safely
                    inputs = None
                    try:
                        # Try with return_tensors first
                        inputs = self.processor(image, return_tensors="pt")  # type: ignore
                    except (TypeError, AttributeError):
                        try:
                            # Fallback without return_tensors parameter
                            inputs = self.processor(image)
                        except Exception as proc_error:
                            print(f"Processor error: {proc_error}")
                            return ""
                    
                    if inputs is None:
                        return ""
                    
                    # Extract pixel values safely
                    pixel_values = safe_get_attr(inputs, 'pixel_values') or safe_getitem(inputs, 'pixel_values') or inputs
                    
                    # Generate with task prompt
                    task_prompt = "<s_cord-v2>"
                    
                    # Access tokenizer safely
                    tokenizer = getattr(self.processor, 'tokenizer', None) or getattr(self.processor, 'feature_extractor', None)
                    if not tokenizer:
                        print("⚠️ No tokenizer found, using simple generation")
                        try:
                            # Ensure pixel_values is proper format
                            if torch and hasattr(torch, 'is_tensor') and not torch.is_tensor(pixel_values):
                                try:
                                    pixel_values = torch.tensor(pixel_values) if torch else pixel_values
                                except Exception:
                                    pass
                            
                            if hasattr(self.model, 'generate') and callable(getattr(self.model, 'generate')):
                                # Type ignore for dynamic model generation
                                generated_ids = self.model.generate(pixel_values, max_length=512)  # type: ignore
                            else:
                                outputs = self.model(pixel_values)
                                generated_ids = outputs.logits.argmax(dim=-1) if hasattr(outputs, 'logits') else outputs
                            
                            if hasattr(self.processor, 'batch_decode'):
                                decoded = self.processor.batch_decode(generated_ids, skip_special_tokens=True)
                                generated_text = decoded[0] if decoded and len(decoded) > 0 else ""
                            else:
                                generated_text = str(generated_ids)
                        except Exception as gen_error:
                            print(f"Generation error: {gen_error}")
                            generated_text = ""
                    else:
                        try:
                            decoder_input_ids = tokenizer(
                                task_prompt, add_special_tokens=False, return_tensors="pt"
                            ).input_ids
                            
                            # Get model configuration safely
                            max_length = 512  # Default fallback
                            try:
                                if hasattr(self.model, 'decoder') and self.model.decoder is not None:
                                    decoder = self.model.decoder
                                    if hasattr(decoder, 'config') and decoder.config is not None:
                                        max_length = getattr(decoder.config, 'max_position_embeddings', 512)
                                elif hasattr(self.model, 'config') and self.model.config is not None:
                                    max_length = getattr(self.model.config, 'max_position_embeddings', 512)
                            except (AttributeError, TypeError):
                                max_length = 512
                            
                            # Generate with proper token IDs
                            generate_kwargs = {
                                "pixel_values": pixel_values,
                                "decoder_input_ids": decoder_input_ids,
                                "max_length": max_length,
                                "use_cache": True,
                                "return_dict_in_generate": True,
                            }
                            
                            # Add token IDs if available
                            if hasattr(tokenizer, 'pad_token_id') and tokenizer.pad_token_id is not None:
                                generate_kwargs["pad_token_id"] = tokenizer.pad_token_id
                            if hasattr(tokenizer, 'eos_token_id') and tokenizer.eos_token_id is not None:
                                generate_kwargs["eos_token_id"] = tokenizer.eos_token_id
                            if hasattr(tokenizer, 'unk_token_id') and tokenizer.unk_token_id is not None:
                                generate_kwargs["bad_words_ids"] = [[tokenizer.unk_token_id]]
                            
                            # Ensure pixel_values is proper format
                            if torch and hasattr(torch, 'is_tensor') and 'pixel_values' in generate_kwargs:
                                pv = generate_kwargs['pixel_values']
                                if not torch.is_tensor(pv):
                                    try:
                                        generate_kwargs['pixel_values'] = torch.tensor(pv)
                                    except Exception:
                                        pass
                            
                            # Generate with error handling
                            generated_ids = None
                            if hasattr(self.model, 'generate') and callable(getattr(self.model, 'generate')):
                                try:
                                    # Type ignore for dynamic model generation with kwargs
                                    generated_ids = self.model.generate(**generate_kwargs)  # type: ignore
                                except Exception as gen_error:
                                    print(f"Model generation error: {gen_error}")
                            
                            if generated_ids is None:
                                # Fallback to forward pass
                                try:
                                    forward_kwargs = {k: v for k, v in generate_kwargs.items() if k == 'pixel_values'}
                                    outputs = self.model(**forward_kwargs)
                                    generated_ids = outputs.logits.argmax(dim=-1) if hasattr(outputs, 'logits') else outputs
                                except Exception as forward_error:
                                    print(f"Forward pass error: {forward_error}")
                                    generated_ids = None
                            
                            # Extract sequences safely
                            if generated_ids is not None:
                                if hasattr(generated_ids, 'sequences'):
                                    # Type ignore for dynamic attribute access
                                    sequences = generated_ids.sequences  # type: ignore
                                else:
                                    sequences = generated_ids
                            else:
                                sequences = None
                            
                            sequence = ""
                            if sequences is not None:
                                try:
                                    if hasattr(self.processor, 'batch_decode'):
                                        decoded = self.processor.batch_decode(sequences)
                                        sequence = decoded[0] if decoded and len(decoded) > 0 else ""
                                    else:
                                        sequence = str(sequences)
                                except Exception as decode_error:
                                    print(f"Sequence decode error: {decode_error}")
                                    sequence = str(sequences)
                            
                            # Clean up tokens safely
                            try:
                                if hasattr(tokenizer, 'eos_token') and tokenizer.eos_token:
                                    sequence = sequence.replace(str(tokenizer.eos_token), "")
                                if hasattr(tokenizer, 'pad_token') and tokenizer.pad_token:
                                    sequence = sequence.replace(str(tokenizer.pad_token), "")
                            except Exception as token_error:
                                print(f"Token cleanup error: {token_error}")
                            
                            generated_text = sequence.split(task_prompt)[-1] if task_prompt in sequence else sequence
                            
                        except Exception as tokenizer_error:
                            print(f"Tokenizer error: {tokenizer_error}")
                            # Fallback to simple generation
                            try:
                                # Ensure pixel_values is proper format
                                if torch and hasattr(torch, 'is_tensor') and not torch.is_tensor(pixel_values):
                                    try:
                                        pixel_values = torch.tensor(pixel_values) if torch else pixel_values
                                    except Exception:
                                        pass
                                
                                generated_ids = None
                                if hasattr(self.model, 'generate') and callable(getattr(self.model, 'generate')):
                                    try:
                                        # Type ignore for dynamic model generation
                                        generated_ids = self.model.generate(pixel_values, max_length=512)  # type: ignore
                                    except Exception:
                                        pass
                                
                                if generated_ids is None:
                                    outputs = self.model(pixel_values)
                                    generated_ids = outputs.logits.argmax(dim=-1) if hasattr(outputs, 'logits') else outputs
                                
                                if hasattr(self.processor, 'batch_decode') and generated_ids is not None:
                                    decoded = self.processor.batch_decode(generated_ids, skip_special_tokens=True)
                                    generated_text = decoded[0] if decoded and len(decoded) > 0 else ""
                                else:
                                    generated_text = str(generated_ids) if generated_ids is not None else ""
                            except Exception as fallback_error:
                                print(f"Fallback generation error: {fallback_error}")
                                generated_text = ""
                            
                except Exception as donut_error:
                    print(f"Donut processing error: {donut_error}")
                    generated_text = ""
            else:
                print(f"⚠️ Unknown model type: {self.model_type}")
                generated_text = ""
            
            return generated_text.strip() if generated_text else ""
            
        except Exception as e:
            print(f"❌ Error recognizing handwriting: {e}")
            return ""
    
    def process_handwritten_exam(self, image: Image.Image) -> Dict[str, Any]:
        """Process a handwritten exam image and extract text"""
        try:
            # Recognize handwriting
            extracted_text = self.recognize_handwriting(image)
            
            # Use existing file processing service to parse structure
            try:
                from app.services.file_service import FileProcessingService
                parsed_questions = FileProcessingService.parse_exam_structure(extracted_text)
            except ImportError:
                # Fallback if service not available
                parsed_questions = [{
                    "question_number": 1,
                    "question_text": extracted_text,
                    "marks": 10
                }]
            except Exception as parse_error:
                print(f"Error parsing exam structure: {parse_error}")
                parsed_questions = [{
                    "question_number": 1,
                    "question_text": extracted_text,
                    "marks": 10
                }]
            
            return {
                "extracted_text": extracted_text,
                "parsed_questions": parsed_questions,
                "total_questions": len(parsed_questions),
                "processing_method": "handwriting_recognition",
                "model_type": self.model_type
            }
            
        except Exception as e:
            return {
                "error": f"Error processing handwritten exam: {str(e)}",
                "extracted_text": "",
                "parsed_questions": [],
                "total_questions": 0
            }

# Function to create service instance safely
def get_handwriting_service() -> HandwritingRecognitionService:
    """Get handwriting recognition service instance"""
    return HandwritingRecognitionService()

# Create global service instance for backward compatibility
handwriting_service = HandwritingRecognitionService()

# Installation and setup instructions
def print_setup_instructions():
    """Print setup instructions for handwriting recognition"""
    print("""
🚀 Handwriting Recognition Setup Instructions:

1. Install required packages:
   pip install datasets matplotlib torch transformers pillow

2. Load the IAM dataset:
   from app.services.handwriting_recognition_service import handwriting_service
   handwriting_service.load_iam_dataset()

3. Inspect the dataset:
   handwriting_service.inspect_dataset()

4. Visualize samples:
   handwriting_service.visualize_samples(num_samples=3)

5. Load a model (choose one):
   handwriting_service.load_trocr_model()  # Recommended for handwriting
   # OR
   handwriting_service.load_donut_model()  # For document understanding

6. Process handwritten exams:
   result = handwriting_service.process_handwritten_exam(pil_image)

📝 Note: This service works alongside the existing file processing service
    to handle both digital documents and handwritten exams.
""")

if __name__ == "__main__":
    print_setup_instructions()