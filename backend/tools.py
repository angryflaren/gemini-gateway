import google.generativeai as genai

# --- ИНСТРУМЕНТЫ ДЛЯ ЗАГОЛОВКОВ ---

# 1. Главный заголовок документа (H1)
make_title = genai.protos.FunctionDeclaration(
    name="make_title",
    description="Создает главный заголовок верхнего уровня для всего ответа (эквивалент H1). Используется один раз в начале.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Текст главного заголовка."),
            "subtitle": genai.protos.Schema(type=genai.protos.Type.STRING, description="Опциональный подзаголовок или краткое описание.")
        },
        required=["content"]
    )
)

# 2. Основной заголовок секции (H2) - бывший make_heading
make_heading = genai.protos.FunctionDeclaration(
    name="make_heading",
    description="Создает основной заголовок для крупного раздела (эквивалент H2).",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Текст заголовка раздела.")
        },
        required=["content"]
    )
)

# 3. Подзаголовок (H3)
make_subheading = genai.protos.FunctionDeclaration(
    name="make_subheading",
    description="Создает подзаголовок для вложенного подраздела (эквивалент H3).",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Текст подзаголовка.")
        },
        required=["content"]
    )
)

# 4. Заголовок с аннотацией/тегом
make_annotated_heading = genai.protos.FunctionDeclaration(
    name="make_annotated_heading",
    description="Создает заголовок с коротким тегом или аннотацией для контекста (например, 'Секция 3 [Важно]').",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Основной текст заголовка."),
            "tag": genai.protos.Schema(type=genai.protos.Type.STRING, description="Короткий тег, например 'Опционально', 'Важно', 'Пример'.")
        },
        required=["content", "tag"]
    )
)

# 5. Заголовок-цитата
make_quote_heading = genai.protos.FunctionDeclaration(
    name="make_quote_heading",
    description="Оформляет ключевую мысль или цитату как стилизованный заголовок-выноску.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Текст цитаты или ключевой мысли."),
            "source": genai.protos.Schema(type=genai.protos.Type.STRING, description="Опциональный источник цитаты.")
        },
        required=["content"]
    )
)


# --- Стандартные инструменты для контента ---

make_text = genai.protos.FunctionDeclaration(
    name="make_text",
    description="Создает обычный текстовый блок.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Содержимое текстового блока.")
        },
        required=["content"]
    )
)

make_code = genai.protos.FunctionDeclaration(
    name="make_code",
    description="Создает блок с кодом.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "language": genai.protos.Schema(type=genai.protos.Type.STRING, description="Язык программирования."),
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Фрагмент кода.")
        },
        required=["language", "content"]
    )
)

make_math = genai.protos.FunctionDeclaration(
    name="make_math",
    description="Создает блок с математической формулой в формате LaTeX.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Формула в синтаксисе LaTeX.")
        },
        required=["content"]
    )
)

make_list = genai.protos.FunctionDeclaration(
    name="make_list",
    description="Создает маркированный или нумерованный список.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "items": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(type=genai.protos.Type.STRING),
                description="Массив строк, представляющих элементы списка."
            )
        },
        required=["items"]
    )
)


# --- ОБНОВЛЕННЫЙ ГЛАВНЫЙ ИНСТРУМЕНТ ---
# Этот инструмент-контейнер теперь знает о всех вариантах заголовков

generate_structured_response = genai.protos.FunctionDeclaration(
    name="generate_structured_response",
    description="Формирует полный структурированный ответ, состоящий из различных блоков контента. Используй разные типы заголовков для лучшей структуры.",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "parts": genai.protos.Schema(
                type=genai.protos.Type.ARRAY,
                items=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                     properties={
                        "type": genai.protos.Schema(type=genai.protos.Type.STRING, description="Тип блока: 'title', 'heading', 'subheading', 'annotated_heading', 'quote_heading', 'text', 'code', 'math', или 'list'"),
                        # --- Общие поля ---
                        "content": genai.protos.Schema(type=genai.protos.Type.STRING, description="Основное содержимое для большинства блоков."),
                        # --- Специализированные поля ---
                        "subtitle": genai.protos.Schema(type=genai.protos.Type.STRING, description="Подзаголовок для блока 'title'."),
                        "tag": genai.protos.Schema(type=genai.protos.Type.STRING, description="Тег для блока 'annotated_heading'."),
                        "source": genai.protos.Schema(type=genai.protos.Type.STRING, description="Источник для 'quote_heading'."),
                        "language": genai.protos.Schema(type=genai.protos.Type.STRING, description="Язык для блока 'code'."),
                        "items": genai.protos.Schema(type=genai.protos.Type.ARRAY, items=genai.protos.Schema(type=genai.protos.Type.STRING), description="Элементы для блока 'list'.")
                    },
                    required=["type"] # Только 'type' является обязательным для всех
                )
            )
        },
        required=["parts"]
    )
)

# Собираем ВСЕ инструменты в один набор
# Хотя мы в основном будем использовать `generate_structured_response`,
# предоставление всех инструментов помогает модели лучше понять доступные опции.
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