import google.generativeai as genai

# --- TOOLS FOR HEADERS ---
make_title = genai.protos.FunctionDeclaration(
    name="make_title",
    description="Creates the main, top-level title for the entire response (like H1). Used once at the beginning.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The text of the main title."),
            "subtitle": genai.protos.Schema(type=genai.protos.Type.STRING, description="An optional subtitle or short description.")
        },
        required=["content"]
    )
)

make_heading = genai.protos.FunctionDeclaration(
    name="make_heading",
    description="Creates a main heading for a large section (like H2).",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The text of the section heading.")
        },
        required=["content"]
    )
)

make_subheading = genai.protos.FunctionDeclaration(
    name="make_subheading",
    description="Creates a subheading for a smaller subsection (like H3).",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The text of the subheading.")
        },
        required=["content"]
    )
)

make_annotated_heading = genai.protos.FunctionDeclaration(
    name="make_annotated_heading",
    description="Creates a heading with a short tag or note for context (e.g., 'Section 3 [Important]').",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The main text of the heading."),
            "tag": genai.protos.Schema(type=genai.protos.Type.STRING, description="A short tag, e.g., 'Optional', 'Important', 'Example'.")
        },
        required=["content", "tag"]
    )
)

make_quote_heading = genai.protos.FunctionDeclaration(
    name="make_quote_heading",
    description="Formats a key idea or quote as a stylized callout heading.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The text of the quote or key idea."),
            "source": genai.protos.Schema(type=genai.protos.Type.STRING, description="The optional source of the quote.")
        },
        required=["content"]
    )
)

# --- Standard Content Tools ---
make_text = genai.protos.FunctionDeclaration(
    name="make_text",
    description="Creates a normal text block.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The content of the text block.")
        },
        required=["content"]
    )
)

make_code = genai.protos.FunctionDeclaration(
    name="make_code",
    description="Creates a block with code.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "language": genai.protos.Schema(type=genai.protos.Type.STRING, description="The programming language."),
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The code snippet.")
        },
        required=["language", "content"]
    )
)

make_math = genai.protos.FunctionDeclaration(
    name="make_math",
    description="Creates a block with a mathematical formula in LaTeX format.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="The formula in LaTeX syntax.")
        },
        required=["content"]
    )
)

make_list = genai.protos.FunctionDeclaration(
    name="make_list",
    description="Creates a bulleted or numbered list.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "items": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(type=genai.protos.Type.STRING),
                description="An array of strings, where each string is a list item."
            )
        },
        required=["items"]
    )
)

# --- UPDATED MAIN TOOL ---
generate_structured_response = genai.protos.FunctionDeclaration(
    name="generate_structured_response",
    description="Forms a complete, structured response made of different content blocks. Use different heading types for better structure. This is the best tool for most answers.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "parts": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "type": genai.protos.Schema(type=genai.protos.Type.STRING, enum=['title', 'heading', 'subheading', 'annotated_heading', 'quote_heading', 'text', 'code', 'math', 'list']),
                        "content": genai.protos.Schema(type=genai.protos.Type.STRING),
                        "subtitle": genai.protos.Schema(type=genai.protos.Type.STRING),
                        "tag": genai.protos.Schema(type=genai.protos.Type.STRING),
                        "source": genai.protos.Schema(type=genai.protos.Type.STRING),
                        "language": genai.protos.Schema(type=genai.protos.Type.STRING),
                        "items": genai.protos.Schema(type=genai.protos.Type.ARRAY, items=genai.protos.Schema(type=genai.protos.Type.STRING))
                    },
                    required=["type"]
                )
            )
        },
        required=["parts"]
    )
)

# NEW: A list of all "simple" tools for easy checking in main.py
ALL_TOOL_NAMES = [
    "make_title", "make_heading", "make_subheading", "make_annotated_heading",
    "make_quote_heading", "make_text", "make_code", "make_math", "make_list"
]

# Collect ALL tools into one set
response_tools = genai.protos.Tool(
    function_declarations=[
        make_title,
        make_heading,
        make_subheading,
        make_annotated_heading,
        make_quote_heading,
        make_text,
        make_code,
        make_math,
        make_list,
        generate_structured_response
    ]
)