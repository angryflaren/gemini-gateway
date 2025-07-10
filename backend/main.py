import os
import re
import zipfile
import tempfile
import subprocess
import json
from pathlib import Path
from typing import List, Any

import google.generativeai as genai
import pathspec
from google.api_core import exceptions as google_exceptions
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Импортируем наш набор инструментов из tools.py
from tools import response_tools

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

def recursive_to_dict(obj: Any) -> Any:
    """
    Рекурсивно преобразует вложенные объекты Google API (MapComposite, ListComposite)
    в стандартные словари и списки Python.
    Это необходимо для корректной JSON-сериализации в FastAPI.
    """
    if hasattr(obj, 'items'):
        # Если объект похож на словарь (имеет метод .items())
        return {key: recursive_to_dict(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)) or (hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes))):
        # Если объект похож на список/кортеж (итерируемый, но не строка/байты)
        return [recursive_to_dict(item) for item in obj]
    else:
        # Возвращаем примитивные типы как есть
        return obj

def load_system_prompt():
    """Загружает системный промпт из файла prompt.xml."""
    try:
        with open("prompt.xml", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print("WARNING: prompt.xml not found. Using a basic fallback prompt.")
        return "You are a helpful programming assistant."

def process_repository_to_text(repo_path_str: str) -> str:
    # Эта функция без изменений
    repo_path = Path(repo_path_str)
    output_parts = []
    default_ignore = [
        '.git/', 'node_modules/', '__pycache__/', 'venv/', 'env/', 'build/', 'dist/',
        '.out/', '*.log', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*',
        '.vscode/', '.idea/', '.DS_Store', 'package-lock.json', 'yarn.lock',
        'pnpm-lock.yaml', 'poetry.lock', '.env', '.env.*', '!/.env.example'
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
        if not file_path.is_file(): continue
        try:
            relative_path_for_spec = file_path.relative_to(repo_path)
            if spec.match_file(str(relative_path_for_spec).replace('\\', '/')): continue
            if file_path.stat().st_size > 10 * 1024 * 1024:
                print(f"Skipping large file {file_path}")
                continue
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            relative_path_for_output = file_path.relative_to(repo_path)
            output_parts.append(f"---\nFile: {relative_path_for_output.as_posix()}\nContent:\n```\n{content}\n```")
        except Exception as e:
            print(f"Could not read file {file_path}: {e}")
    return "\n".join(output_parts)


async def refine_prompt_for_coding(api_key: str, user_prompt: str, refiner_model_id: str) -> str:
    # Эта функция без изменений
    if len(user_prompt.strip()) < 2:
        return user_prompt
    refiner_system_prompt = """
# System Prompt: Strategic Query Architect
# Role
You are a Strategic Query Architect. Your function is to intercept a raw user query and re-engineer it into a master-level instruction set for a downstream "Gemini Architect" AI model. Your transformation must not only preserve the user's original intent but elevate it, compelling the downstream AI to deliver solutions of the highest possible quality in terms of correctness, architecture, security, and clarity.
# CRITICAL DIRECTIVES
- **Semantic Isomorphism (Top Priority):** The rewritten query MUST be a perfect semantic mirror of the input's core intent. Preserve all explicit technical terms and constraints. No information loss is permitted.
- **Language Parity:** The output language MUST strictly match the input language. Do not translate.
- **Intent-Driven Amplification (Key Mandate):**
  - **Infer the True Goal:** Analyze the user's query to understand their ultimate objective, not just their literal question.
  - **Elevate the Request:** If the query is simple (e.g., "how to do X"), transform it into a request for a **production-ready, robust, and well-documented solution**.
  - **Demand Deeper Analysis:** If the query involves code, rewrite it to explicitly demand that the downstream AI analyze **scalability, security vulnerabilities, edge cases, and architectural best practices**.
- **Maintain Proportionality:** If the query is clearly seeking a brief, factual answer (e.g., "what is the syntax for a for-loop in Python?"), provide a clean, direct question. Do not over-amplify trivial requests.
- **Atomic Output:** Your output MUST BE ONLY the rewritten query text. No explanations, no apologies, no conversational text, no markdown.
- **Passthrough Protocol:** If the input is non-technical, purely conversational, or too vague to architect (e.g., "привет", "спасибо"), return it completely unchanged.
# Internal Process
1.  **Deconstruct & Infer:** Break down the user's query and deduce their true intent.
2.  **Architect the New Query:** Based on the inferred intent, construct a new, superior query. Frame it as a set of instructions for an expert-level AI. Explicitly include prompts for self-correction, consideration of alternatives, and detailed justifications.
3.  **Final Polish:** Ensure the final query is clean, precise, and ready for the downstream model.
"""
    try:
        genai.configure(api_key=api_key)
        refiner_model = genai.GenerativeModel(refiner_model_id)
        full_prompt = f"{refiner_system_prompt}\n\nUser prompt to refine:\n\"{user_prompt}\""
        response = await refiner_model.generate_content_async(full_prompt)
        refined_text = response.text.strip()
        return refined_text if refined_text else user_prompt
    except Exception as e:
        print(f"Could not refine prompt due to an error: {e}. Using original prompt.")
        return user_prompt


# --- API Endpoints ---
@app.post("/api/clone_repo")
async def clone_repo(repo_request: RepoRequest):
    # Этот эндпоинт без изменений
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_url = repo_request.url
        match = re.search(r"github\.com/([^/]+/[^/]+?)(?:\.git|/tree/([^/]+)|/*$)", repo_url)
        if not match:
            raise HTTPException(status_code=400, detail="Could not parse GitHub URL.")
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
    prompt_parts: List[Any] = [system_prompt]
    
    print(f"Refining user prompt: '{prompt}'")
    refined_prompt = await refine_prompt_for_coding(apiKey, prompt, refinerModel)
    print(f"Refined prompt: '{refined_prompt}'")
    prompt_parts.append(f"\n\nUser Request: {refined_prompt}\n\n")

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
        
        generation_model = genai.GenerativeModel(
            model_name=model,
            tools=[response_tools]
        )
        
        response = await generation_model.generate_content_async(
            prompt_parts,
            tool_config={"function_calling_config": "ANY"}
        )
        
        part = response.candidates[0].content.parts[0]
        
        if not hasattr(part, 'function_call') or not part.function_call.name:
            error_text = response.text if hasattr(response, 'text') else "Model did not call a function."
            return [{"type": "text", "content": f"AI did not return the expected function call. Response: {error_text}"}]

        if part.function_call.name != "generate_structured_response":
            return [{"type": "text", "content": f"AI called an unexpected function: {part.function_call.name}"}]

        args = part.function_call.args
        
        if not args or 'parts' not in args:
             return [{"type": "text", "content": "AI response is missing the 'parts' field."}]

        py_response = recursive_to_dict(args)
        
        # НОВОЕ ИЗМЕНЕНИЕ: Фильтруем ответ, чтобы отправлять только поддерживаемые типы блоков.
        # Это делает бэкенд устойчивым к новым типам блоков, которые может сгенерировать модель,
        # но которые еще не поддерживаются фронтендом.
        supported_types = {'title', 'heading', 'subheading', 'annotated_heading', 'quote_heading', 'text', 'code', 'math', 'list'}
        filtered_parts = [
            part for part in py_response.get('parts', [])
            if isinstance(part, dict) and part.get('type') in supported_types
        ]

        # Проверяем, если после фильтрации ничего не осталось, а изначально что-то было.
        if not filtered_parts and py_response.get('parts'):
            print(f"Warning: AI returned only unsupported block types. Original parts: {py_response.get('parts')}")
            # Отправляем понятное сообщение об ошибке на фронтенд.
            return [{"type": "text", "content": "AI returned content in an unsupported format that cannot be displayed."}]

        # Возвращаем только отфильтрованный, "чистый" список словарей.
        return filtered_parts

    except google_exceptions.InvalidArgument as e:
        raise HTTPException(status_code=400, detail=f"Invalid argument to API. Details: {e}")
    except Exception as e:
        # Добавляем вывод полного traceback для лучшей диагностики
        import traceback
        error_content = f"CRITICAL: An error occurred during Gemini API call: {str(e)}\n{traceback.format_exc()}"
        print(error_content)
        return [{"type": "code", "language": "error", "content": error_content}]
