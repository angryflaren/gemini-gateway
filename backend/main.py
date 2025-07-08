import os
import re
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import zipfile
import tempfile
from pathlib import Path
import subprocess
from pydantic import BaseModel
from typing import List

# --- FastAPI App Initialization & CORS ---
app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://angryflaren.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class RepoRequest(BaseModel):
    url: str

# --- Helper Functions ---
def load_system_prompt():
    try:
        with open("prompt.xml", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "You are a helpful programming assistant."

def process_repository_to_text(repo_path_str: str) -> str:
    repo_path = Path(repo_path_str)
    output_parts = []
    ignore_patterns = {'.git', 'node_modules', '__pycache__', '.vscode', '.idea'}

    for file_path in repo_path.rglob('*'):
        if file_path.is_file():
            if any(part in ignore_patterns for part in file_path.parts):
                continue
            
            relative_path = file_path.relative_to(repo_path)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                # Исправленная строка с .as_posix()
                output_parts.append(f"---\nFile: {relative_path.as_posix()}\nContent:\n```\n{content}\n```")
            except Exception as e:
                print(f"Could not read file {file_path}: {e}")
            
    return "\n".join(output_parts)

async def self_correct_json_response(api_key: str, faulty_text: str, model_id: str) -> str:
    """
    Sends faulty text back to the model and asks it to correct the JSON structure.
    """
    correction_prompt = """
The following text contains a potentially malformed JSON array, possibly wrapped in a markdown code block. Your objective is to isolate the JSON content, correct all syntax violations to ensure it becomes a syntactically valid JSON array, and return ONLY(!) the raw, corrected JSON string. Do not output any wrappers, markdown, code fences, or explanatory text.

Faulty text to correct:
    """
    try:
        # We use the fast model for this correction task
        corrector_model = genai.GenerativeModel(model_id)
        genai.configure(api_key=api_key)
        
        full_prompt = f"{correction_prompt}\n\n{faulty_text}"
        response = await corrector_model.generate_content_async(full_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"JSON self-correction failed: {e}")
        return "" # Return empty string on failure

async def refine_prompt_for_coding(api_key: str, user_prompt: str, refiner_model_id: str) -> str:
    refiner_system_prompt = """
System Prompt: Query Normalization Engine
Role: High‑fidelity query pre‑processor. Your task is to transform a raw user query into a clean, precise, unambiguous instruction optimized for a powerful downstream AI model.

CRITICAL DIRECTIVES:
Semantic Isomorphism (Top Priority): The output MUST be a perfect semantic mirror of the input, preserving 100 % of the original intent and all technical terms verbatim. No information loss is permitted.
Language Parity: Output language MUST strictly match the input language. No translation.
Clarify, Don’t Invent: Resolve ambiguity and correct errors (grammar, typos, slang) into their most probable technical meaning. Do not add new information or steps.
Atomic Output: The response MUST be only the refined text, with no wrappers, greetings, or explanations.

Internal Process: Deconstruct the query, resolve ambiguities, and verify semantic integrity before generating the final, clean text.

Examples of Transformation:

Example 1 (Technical & Language Preservation)
Input: нужно чтобы функция calculate_totalиспользовалаdecimalдля точности, а не float, и обработалаNone как 0
Output: Необходимо рефакторить функцию calculate_total таким образом, чтобы она использовала тип данных Decimal вместо float для обеспечения высокой точности вычислений, а также корректно обрабатывала входное значение None как ноль.

Example 2 (Colloquial to Technical)
Input: this code is busted, the loop is all wrong and it crashes. fix it
Output: The provided code is non‑functional. Analyze the loop structure, identify the cause of the runtime error, and implement the necessary corrections to ensure the code executes successfully.
    """
    
    try:
        refiner_model = genai.GenerativeModel(refiner_model_id)
        genai.configure(api_key=api_key)

        full_prompt = f"{refiner_system_prompt}\n\nUser request to expand into a technical plan:\n\"{user_prompt}\""
        response = await refiner_model.generate_content_async(full_prompt)
        
        refined_text = response.text.strip()
        if refined_text:
            return refined_text
        
        print("Prompt refinement returned empty, using original prompt.")
        return user_prompt

    except Exception as e:
        print(f"Could not refine prompt due to an error: {e}. Using original prompt.")
        return user_prompt

# --- API Endpoints ---
@app.post("/api/clone_repo")
async def clone_repo(repo_request: RepoRequest):
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_url = repo_request.url
        
        match = re.search(r"github\.com/([^/]+/[^/]+?)(?:\.git|/tree/([^/]+)|/*$)", repo_url)
        if not match:
            raise HTTPException(status_code=400, detail="Could not parse GitHub URL. Please provide a valid repository URL.")

        repo_path = match.group(1) # e.g., "angryflaren/jubilant-enigma"
        branch = match.group(2)
        
        # Создаем специальное имя файла: gh_repo:::owner---repo-name
        # Это позволит нам легко опознать и распарсить его на фронтенде
        safe_repo_path = repo_path.replace('/', '---')
        repo_name_for_file = f"gh_repo:::{safe_repo_path}"
        
        clone_url = f"https://github.com/{repo_path}.git"
        
        command = ["git", "clone", "--depth", "1"]
        if branch:
            command.extend(["--branch", branch])
            print(f"Cloning branch '{branch}' from repository: {clone_url}")
        else:
            print(f"Cloning default branch from repository: {clone_url}")
        
        command.extend([clone_url, temp_dir])

        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
            processed_text = process_repository_to_text(temp_dir)
            # Возвращаем специальное имя файла
            return {"repo_name": repo_name_for_file, "processed_text": processed_text}
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=400, detail=f"Failed to clone repository. Is the URL correct and public?\nDetails: {e.stderr}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.post("/api/generate")
async def generate_response(
    apiKey: str = Form(...),
    prompt: str = Form(...),
    model: str = Form(...),
    refinerModel: str = Form(...),
    files: List[UploadFile] = File(default=[])
):
    print(f"Received request for model: {model} with {len(files)} files.")
    
    system_prompt = load_system_prompt()
    prompt_parts = [system_prompt, f"\n\nUser Request: {prompt}\n\n"] # Этот элемент будет заменен
    
    for file in files:
        contents = await file.read()
        
        supported_image_types = ["image/png", "image/jpeg", "image/webp"]
        supported_text_types = ["text/plain", "text/xml", "application/json", "text/javascript", "text/css", "text/html", "text/x-python"]
        supported_zip_types = ["application/zip", "application/x-zip-compressed"]
        
        if file.content_type in supported_zip_types:
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, file.filename or "repo.zip")
                with open(zip_path, "wb") as f: f.write(contents)
                extract_path = os.path.join(temp_dir, "unzipped_repo")
                os.makedirs(extract_path, exist_ok=True)
                with zipfile.ZipFile(zip_path, 'r') as zip_ref: zip_ref.extractall(extract_path)
                project_name = Path(file.filename).stem if file.filename else "project"
                repo_as_text = process_repository_to_text(extract_path)
                prompt_parts.append(f"--- Provided Repository: {project_name} ---\n{repo_as_text}\n--- End Repository: {project_name} ---")
        elif file.content_type in supported_image_types:
            prompt_parts.append({"mime_type": file.content_type, "data": contents})
        elif file.content_type in supported_text_types:
            prompt_parts.append(f"--- Provided File: {file.filename} ---\n```\n{contents.decode('utf-8')}\n```\n--- End File: {file.filename} ---")
        else:
            print(f"Skipping unsupported file type: {file.content_type}")
        await file.close()

    try:
        genai.configure(api_key=apiKey)
        generation_model = genai.GenerativeModel(model)

        # Шаг 1: Усиление пользовательского запроса через Gemini-Flash
        print(f"Refining user prompt via API: '{prompt}'")
        refined_prompt = await refine_prompt_for_coding(apiKey, prompt, refinerModel)
        print(f"Refined prompt: '{refined_prompt}'")

        # Обновляем prompt_parts для основного запроса
        prompt_parts[1] = f"\n\nUser Request: {refined_prompt}\n\n"
        
        # Шаг 2: Основной запрос с усиленным промптом
        response = await generation_model.generate_content_async(prompt_parts)
        gemini_response_text = response.text

    except google_exceptions.InvalidArgument as e:
        raise HTTPException(status_code=400, detail=f"Invalid argument provided to the API. Check your request and file formats. Details: {e}")
    except google_exceptions.PermissionDenied as e:
        raise HTTPException(status_code=403, detail=f"API Key is not valid or lacks permissions. Details: {e}")
    except google_exceptions.ResourceExhausted as e:
        error_message = "**Превышен лимит токенов или другая квота ресурсов.** Попробуйте менее сложный запрос или файлы меньшего размера."
        return [{"type": "text", "content": error_message}, {"type": "code", "language": "error", "content": str(e)}]
    except Exception as e:
        error_detail = str(e)
        raise HTTPException(status_code=500, detail=f"Error during Gemini API call: {error_detail}")
    
    try:
        # Primary attempt to find and parse JSON
        json_match = re.search(r'```json\s*(\[.*\])\s*```', gemini_response_text, re.DOTALL)
        if json_match:
            json_string = json_match.group(1).strip()
            return json.loads(json_string)
        
        # If parsing fails or no match, trigger self-correction
        print("Initial JSON parsing failed. Attempting self-correction...")
        corrected_json_string = await self_correct_json_response(apiKey, gemini_response_text, refinerModel)
        
        # Second attempt to parse the corrected JSON
        if corrected_json_string:
            try:
                return json.loads(corrected_json_string)
            except json.JSONDecodeError:
                print("Self-correction also failed to produce valid JSON.")
                # Fallthrough to the final error message

    except json.JSONDecodeError:
        # This block is now less likely to be hit directly but serves as a final catch-all
        pass

    # If all attempts fail, return a detailed error
    error_content = (
        f"CRITICAL: AI response could not be parsed as JSON, even after self-correction.\n\n"
        f"--- Full AI Response ---\n{gemini_response_text}"
    )
    return [{"type": "code", "language": "error", "content": error_content}]
