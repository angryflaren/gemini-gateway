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

# import our toolset from tools.py
from tools import response_tools, ALL_TOOL_NAMES

# --- FastAPI App Initialization & CORS ---
app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ""https://angryflaren.github.io/gemini-gateway/" ",
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
    # FIXED: Added a check for None to avoid errors
    if obj is None:
        return None
    if hasattr(obj, 'items'):
        return {key: recursive_to_dict(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)) or (hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes))):
        return [recursive_to_dict(item) for item in obj]
    else:
        return obj

def load_system_prompt():
    try:
        with open("prompt.xml", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print("WARNING: prompt.xml not found. Using a basic fallback prompt.")
        return "You are a helpful programming assistant."

def process_repository_to_text(repo_path_str: str) -> str:
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
    if len(user_prompt.strip()) < 2:
        return user_prompt
    refiner_system_prompt = """
# System Prompt: Smart Query Builder
# Role
You are a Smart Query Builder. Your job is to take a user's question and make it better. The new question should be a perfect instruction for another AI, the "Gemini Architect". Your new question must keep the user's idea. But it should also make it better, so the other AI gives a very good answer. The answer should be correct, secure, and clear.
# VERY IMPORTANT RULES
- **Keep the Meaning (Top Priority):** The new question MUST mean the same thing as the user's question. Keep all special words and rules. Do not lose any information.
- **Same Language:** The output language MUST be the same as the input language. Do not translate.
- **Make the Idea Better (Main Job):**
  - **Find the Real Goal:** Look at the user's question to understand what they really want to do.
  - **Improve the Request:** If the question is simple (like "how to do X"), change it to ask for a solution that is ready for real use, strong, and has good explanations.
  - **Ask for More Details:** If the question is about code, change it to ask the AI to check for security problems, special cases, and good ways to build the code.
  - **Keep it Simple for Simple Questions:** If the user asks a small, easy question (like "what is a for-loop in Python?"), just make the question clean and direct. Do not make small questions too big.
- **Only the New Question:** Your output MUST BE only the new question text. No "hello", no "sorry", no extra words, no markdown.
- **Do Nothing Protocol:** If the question is not about tech, is just talking, or is not clear (like "hello", "thank you"), return it exactly as it is.
# Your Process
1.  **Understand:** Read the user's question and find their real goal.
2.  **Build the New Question:** Make a new, better question. Write it like instructions for an expert AI. Tell it to check its work and explain why it chose its solution.
3.  **Final Check:** Make sure the new question is clean, clear, and ready for the next AI model.
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
    system_prompt = load_system_prompt()
    prompt_parts: List[Any] = [system_prompt]
    
    refined_prompt = await refine_prompt_for_coding(apiKey, prompt, refinerModel)
    prompt_parts.append(f"\n\nUser Request: {refined_prompt}\n\n")

    for file in files:
        contents = await file.read()
        filename = file.filename
        
        if filename.endswith('.zip'):
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, filename)
                with open(zip_path, 'wb') as f:
                    f.write(contents)
                
                unzip_dir = os.path.join(temp_dir, 'unzipped')
                os.makedirs(unzip_dir, exist_ok=True)
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(unzip_dir)
                
                # FIXED: Improved logic for finding the root folder
                # Instead of guessing, we find the common prefix for all files, which is much more reliable.
                all_paths = [os.path.join(unzip_dir, f) for f in zip_ref.namelist() if not f.startswith('__MACOSX')]
                if not all_paths:
                     # If the archive is empty or contains only system folders
                    processed_text = ""
                else:
                    # Find the common root path
                    common_prefix = os.path.commonpath(all_paths)
                    # If the common prefix is the extraction folder itself, use it.
                    # If there is one common folder inside, use it.
                    repo_content_path = common_prefix if os.path.isdir(common_prefix) else unzip_dir
                    processed_text = process_repository_to_text(repo_content_path)

                prompt_parts.append(f"--- Provided ZIP Content: {filename} ---\n{processed_text}\n--- End ZIP Content ---")

        else:
            try:
                # FIXED: Added decoding error handling
                decoded_contents = contents.decode('utf-8')
                prompt_parts.append(f"--- Provided File: {filename} ---\n```\n{decoded_contents}\n```\n--- End File: {filename} ---")
            except UnicodeDecodeError:
                prompt_parts.append(f"--- Provided File: {filename} ---\n[Binary file, content not displayed]\n--- End File: {filename} ---")

        
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
            if hasattr(response, 'text') and response.text:
                return [{"type": "text", "content": response.text}]
            return [{"type": "text", "content": "Error: Model returned an empty response without a function call."}]

        final_parts = []
        function_name = part.function_call.name
        function_args = recursive_to_dict(part.function_call.args)

        if function_name == "generate_structured_response":
            # FIXED: We now check each block inside 'parts'
            raw_parts = function_args.get('parts', [])
            if isinstance(raw_parts, list):
                for p in raw_parts:
                    # We check that 'p' is a dictionary and has a 'type' key
                    if isinstance(p, dict) and 'type' in p:
                        final_parts.append(p)
                    else:
                        print(f"Warning: Skipping malformed part in structured response: {p}")
            else:
                 print(f"Warning: 'parts' in structured response is not a list: {raw_parts}")

        elif function_name in ALL_TOOL_NAMES:
            # FIXED: Added basic validation for simple tools
            block_type = function_name.replace('make_', '')
            is_valid = True
            if block_type == 'list' and not isinstance(function_args.get('items'), list):
                is_valid = False
            elif 'content' not in function_args: # Most other tools require 'content'
                is_valid = False

            if is_valid:
                new_part = {"type": block_type, **function_args}
                final_parts.append(new_part)
            else:
                print(f"Warning: AI called function '{function_name}' with invalid args: {function_args}")
        else:
            return [{"type": "code", "language": "error", "content": f"AI called an unexpected function: {function_name}\n\nArguments: {json.dumps(function_args, indent=2)}"}]
        
        if not final_parts:
            # FIXED: Return the original response text if nothing is left after processing
            if hasattr(response, 'text') and response.text:
                return [{"type": "text", "content": f"[Fallback Content]\n{response.text}"}]
            return [{"type": "text", "content": "AI response was empty or malformed after processing the function call."}]
        
        supported_types = {'title', 'heading', 'subheading', 'annotated_heading', 'quote_heading', 'text', 'code', 'math', 'list'}
        filtered_parts = [
            p for p in final_parts
            if isinstance(p, dict) and p.get('type') in supported_types
        ]

        if not filtered_parts and final_parts:
            print(f"Warning: AI returned only unsupported block types. Original parts: {final_parts}")
            # FIXED: Also added logic to fall back to the original text
            if hasattr(response, 'text') and response.text:
                return [{"type": "text", "content": f"[Fallback Content]\n{response.text}"}]
            return [{"type": "text", "content": "AI returned content in an unsupported format that cannot be displayed."}]

        return filtered_parts

    except google_exceptions.InvalidArgument as e:
        raise HTTPException(status_code=400, detail=f"Invalid argument to API. Details: {e}")
    # FIXED: Added catching for InternalServerError for a more informative message
    except google_exceptions.InternalServerError as e:
        error_content = f"Google API Error (500): The server encountered an internal error. This often happens if the AI model tries to generate a malformed response. Please try modifying your prompt or reducing the amount of context. Details: {e}"
        print(error_content)
        return [{"type": "code", "language": "error", "content": error_content}]
    except Exception as e:
        import traceback
        error_content = f"CRITICAL: An error occurred during Gemini API call: {str(e)}\n{traceback.format_exc()}"
        print(error_content)
        return [{"type": "code", "language": "error", "content": error_content}]
