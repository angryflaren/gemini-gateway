import os
import re
import json
import zipfile
import tempfile
import subprocess
from pathlib import Path
from typing import List
import pathspec

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    
    # Расширенный список игнорирования по умолчанию
    default_ignore = [
        # Git
        '.git/',
        # Зависимости
        'node_modules/',
        '__pycache__/',
        'venv/',
        'env/',
        # Артефакты сборки
        'build/',
        'dist/',
        '.out/',
        # Логи и временные файлы
        '*.log',
        'npm-debug.log*',
        'yarn-debug.log*',
        'yarn-error.log*',
        # Файлы IDE
        '.vscode/',
        '.idea/',
        '.DS_Store',
        # Файлы блокировок зависимостей
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'poetry.lock',
        # Файлы окружения
        '.env',
        '.env.*',
        '!/.env.example'
    ]
    
    patterns = default_ignore
    gitignore_path = repo_path / '.gitignore'
    
    if gitignore_path.is_file():
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                patterns.extend(f.read().splitlines())
        except Exception as e:
            print(f"Could not read .gitignore file: {e}")
            
    spec = pathspec.PathSpec.from_lines('gitwildmatch', patterns)

    for file_path in repo_path.rglob('*'):
        if not file_path.is_file():
            continue

        relative_path_for_spec = file_path.relative_to(repo_path)
        if spec.match_file(str(relative_path_for_spec).replace('\\', '/')):
            continue
            
        try:
            # Пропускаем слишком большие файлы, чтобы избежать проблем
            if file_path.stat().st_size > 10 * 1024 * 1024: # 2MB
                print(f"Skipping large file {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            relative_path_for_output = file_path.relative_to(repo_path)
            output_parts.append(f"---\nFile: {relative_path_for_output.as_posix()}\nContent:\n```\n{content}\n```")
        except Exception as e:
            print(f"Could not read file {file_path}: {e}")
            
    return "\n".join(output_parts)

async def self_correct_json_response(api_key: str, faulty_text: str, model_id: str) -> str:
    correction_prompt = """
The following text contains a potentially malformed JSON array, possibly wrapped in a markdown code block. Your objective is to isolate the JSON content, correct all syntax violations to ensure it becomes a syntactically valid JSON array, and return ONLY(!) the raw, corrected JSON string. Do not output any wrappers, markdown, code fences, or explanatory text.

Faulty text to correct:
    """
    try:
        corrector_model = genai.GenerativeModel(model_id)
        genai.configure(api_key=api_key)
        
        full_prompt = f"{correction_prompt}\n\n{faulty_text}"
        response = await corrector_model.generate_content_async(full_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"JSON self-correction failed: {e}")
        return ""

async def refine_prompt_for_coding(api_key: str, user_prompt: str, refiner_model_id: str) -> str:
    if len(user_prompt.strip()) < 2:
        print("Prompt is too short, skipping refinement.")
        return user_prompt
    
    refiner_system_prompt = """
# System Prompt: Query Maximization Engine

# Role
High-fidelity query pre-processor and amplifier. Your task is to transform a raw user query into a clean, precise, unambiguous instruction, optimized for a highly capable downstream AI model. The transformation must preserve original intent while **encouraging** the downstream model to perform at maximum capacity — providing solutions, detailed reasoning, improvements, and alternatives wherever the user’s query logically permits it.

# CRITICAL DIRECTIVES

- **Semantic Isomorphism (Top Priority):**
  The output MUST be a perfect semantic mirror of the input. Preserve 100% of the original intent and all explicit technical terms. No information loss is permitted.

- **Language Parity:**
  The output language MUST strictly match the input language. Do not translate or localize.

- **Clarify, Don’t Invent:**
  Resolve ambiguities, fix grammar, spelling, or shorthand. Convert vague wording into its most probable technical form. Do NOT add ideas not present in the input.

- **Amplify When Appropriate:**
  If the input suggests a problem, error, unexpected behavior, or ambiguity (e.g., “почему этот код работает так...”), then encourage the downstream AI to:
  - Explain in detail **why** it happens
  - Propose and justify **one or more possible solutions**
  - Suggest **ways to improve** or restructure the code/query
  - Highlight **edge cases**, **pitfalls**, or **related best practices**

  However, if the input is clearly seeking only a brief factual answer, **do not over-extend** — preserve the appropriate level of verbosity.

- **Atomic Output:**
  Respond with only the rewritten query. No wrapping, no explanations, no tags, no commentary. Only emit the clean instruction.

- **Passthrough for Non-Technical or Trivial Input:**
  If the input is non-technical, too vague to refine, or purely conversational (e.g. "привет", "спасибо", "можешь помочь?"), return it unchanged. Do not analyze, expand, or apologize.

# Internal Process
Carefully analyze the user's query. If it contains ambiguity or signals that a deep, multi-layered response could help the user, **structure the rewritten prompt to elicit** the fullest, clearest, and most useful answer from the downstream model. If the request is minimal, keep the rewrite equally minimal.

# Example Transformations

- **Input:** почему эта функция неправильно работает при нуле?
- **Output:** Объясни, почему эта функция работает неправильно при передаче значения 0. Предложи возможные причины, краткое объяснение и одно или несколько исправлений.

- **Input:** что делает этот фрагмент кода?
- **Output:** Расскажи, что делает этот фрагмент кода, и объясни пошагово логику его работы. Укажи возможные недостатки и предложи улучшения, если это уместно.

- **Input:** привет
- **Output:** привет
"""
    
    try:
        refiner_model = genai.GenerativeModel(refiner_model_id)
        genai.configure(api_key=api_key)
        full_prompt = f"{refiner_system_prompt}\n\nUser prompt to refine:\n\"{user_prompt}\""
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
    # ... (Этот код остается без изменений) ...
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_url = repo_request.url
        
        match = re.search(r"github\.com/([^/]+/[^/]+?)(?:\.git|/tree/([^/]+)|/*$)", repo_url)
        if not match:
            raise HTTPException(status_code=400, detail="Could not parse GitHub URL. Please provide a valid repository URL.")

        repo_path = match.group(1)
        branch = match.group(2)
        
        safe_repo_path = repo_path.replace('/', '---')
        repo_name_for_file = f"gh_repo:::{safe_repo_path}"
        
        clone_url = f"https://github.com/{repo_path}.git"
        
        command = ["git", "clone", "--depth", "1"]
        if branch:
            command.extend(["--branch", branch])
        
        command.extend([clone_url, temp_dir])

        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
            processed_text = process_repository_to_text(temp_dir)
            return {"repo_name": repo_name_for_file, "processed_text": processed_text}
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=400, detail=f"Failed to clone repository: {e.stderr}")
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
    prompt_parts = [system_prompt, f"\n\nUser Request: {prompt}\n\n"]
    
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

        print(f"Refining user prompt via API: '{prompt}'")
        refined_prompt = await refine_prompt_for_coding(apiKey, prompt, refinerModel)
        print(f"Refined prompt: '{refined_prompt}'")

        prompt_parts[1] = f"\n\nUser Request: {refined_prompt}\n\n"
        
        response = await generation_model.generate_content_async(prompt_parts)
        gemini_response_text = response.text

    except google_exceptions.InvalidArgument as e:
        raise HTTPException(status_code=400, detail=f"Invalid argument provided to the API. Check your request and file formats. Details: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during Gemini API call: {str(e)}")
    
    # --- Финальный, исправленный блок парсинга ---
    if not gemini_response_text or not gemini_response_text.strip():
        return [{"type": "code", "language": "error", "content": "CRITICAL: The AI model returned an empty response. This may be due to safety filters or an internal model error."}]

    try:
        json_match = re.search(r'```json\s*(\[.*\])\s*```', gemini_response_text, re.DOTALL)
        if json_match:
            json_string = json_match.group(1).strip()
            return json.loads(json_string)
        else:
            raise json.JSONDecodeError("No JSON code block found in AI response", gemini_response_text, 0)
    except json.JSONDecodeError:
        print("Initial JSON parsing failed. Attempting self-correction...")
        corrected_json_string = await self_correct_json_response(apiKey, gemini_response_text, refinerModel)
        if corrected_json_string:
            try:
                return json.loads(corrected_json_string)
            except json.JSONDecodeError:
                print("Self-correction also failed to produce valid JSON.")
        
        # Если ничего не сработало, возвращаем финальную ошибку
        error_content = (
            f"CRITICAL: The AI's response could not be parsed as valid JSON, even after an attempt to self-correct.\n\n"
            f"--- Full AI Response ---\n{gemini_response_text}"
        )
        return [{"type": "code", "language": "error", "content": error_content}]
