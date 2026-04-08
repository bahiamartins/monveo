# Monveo SEO Chat

Aplicativo de chat inteligente focado em **SEO e marketing de conteúdo digital**, construído com Flask no backend usando o SDK **[google-genai](https://pypi.org/project/google-genai/)** (`from google import genai`) em modo **Vertex AI** (Gemini 2.5 Pro), e React + TypeScript no frontend. Todo o histórico de conversas é persistido no Firestore.

---

## Arquitetura

```
monveo/
├── .gitignore                  # Ignora credenciais, .env, node_modules, build
├── SECURITY.md                 # Boas práticas e rotação de chaves
├── .env.example                # Variáveis opcionais documentadas
├── backend/                    # API Flask (Python)
│   ├── chat_app.py             # Rotas principais + Gemini (genai.Client) + prompt SEO + CORS
│   ├── chat_memory.py          # Gerenciamento de sessões no Firestore
│   ├── firestore.py            # Cliente Firestore + helpers de sessão
│   ├── app.py                  # Wrapper para compatibilidade
│   ├── requirements.txt
│   ├── google_auth.example.json  # Modelo do JSON da service account (versionar)
│   ├── google_auth.json        # Credenciais reais — criar localmente, NUNCA commitar
│   └── Dockerfile
├── frontend/                   # App React (TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx             # Estado global + orquestração
│   │   ├── api.ts              # Wrappers fetch para todos os endpoints
│   │   ├── types.ts
│   │   └── components/
│   │       ├── Sidebar.tsx     # Lista de conversas + edição de títulos
│   │       ├── ChatArea.tsx    # Área de mensagens com scroll automático
│   │       ├── MessageBubble.tsx  # Renderização markdown + botão copiar
│   │       └── ChatInput.tsx   # Textarea expansível
│   ├── nginx.conf              # Proxy /api → backend (produção)
│   └── Dockerfile
└── docker-compose.yml          # Sobe backend + frontend juntos
```

---

## Pré-requisitos

- **Docker + Docker Compose** (recomendado para rodar tudo junto)
- ou **Python 3.11+** e **Node 20+** para rodar localmente
- Service account Google com acesso ao projeto GCP configurado e à database Firestore `mktjob` (ou a que você usar)
- Arquivo **`backend/google_auth.json`** com a chave da service account (não vem no repositório)

### GitHub / clone novo

1. Copie `backend/google_auth.example.json` para `backend/google_auth.json` e preencha com um JSON válido baixado do [Console GCP](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Confirme que `git status` **não** lista `google_auth.json` (ele deve estar coberto pelo `.gitignore`).
3. Leia [SECURITY.md](SECURITY.md) — se essa chave já tiver sido exposta em algum lugar, **revogue e crie outra** no console.

---

## Rodar com Docker (recomendado)

```bash
cd monveo
docker compose up --build
```

Abra **http://localhost** no navegador.

> O JSON da service account é montado como volume **somente leitura**; o `backend/.dockerignore` impede que `google_auth.json` entre na imagem no `docker build`.  
> Para apontar para um arquivo fora da pasta do projeto: `MONVEO_GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/sua-chave.json docker compose up --build`

Para parar:

```bash
docker compose down
```

---

## Rodar localmente (desenvolvimento)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# ou: .venv\Scripts\Activate.ps1  # Windows

pip install -r requirements.txt

GOOGLE_APPLICATION_CREDENTIALS=google_auth.json python app.py

flask run
```

Backend disponível em: http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponível em: http://localhost:5173

O Vite proxy encaminha `/api` para `http://localhost:5000` automaticamente em desenvolvimento.

---

## Funcionalidades

- **Chat SEO especializado** — prompt de sistema em português focado em SEO on-page, palavras-chave, meta descrições e conteúdo para WordPress
- **Geração de imagens/infográficos** — ao detectar pedidos como "gere um infográfico", "crie uma imagem" etc., o agente principal aciona automaticamente o agente gráfico (Vertex AI Imagen), gera a imagem e exibe com botão de download
- **Imagens sem branding** — geradas com `add_watermark=False`, sem nenhuma marca visível do Gemini
- **Armazenamento no Google Cloud Storage** — imagens salvas automaticamente no bucket configurado e disponíveis via URL pública para download
- **Histórico persistente** — todas as conversas salvas no Firestore (`chat_sessions`), incluindo referências às imagens geradas
- **Sidebar com conversas** — títulos editáveis inline, exclusão e criação de novas conversas
- **Carregamento de histórico** — ao abrir uma conversa, carrega as últimas 15 mensagens
- **Respostas formatadas** — renderização Markdown completa (headings, tabelas, listas, código) com botão **Copiar** para colar direto no WordPress ou Word
- **Input HTML-aware** — textarea expansível que aceita HTML colado como contexto

---

## Endpoints da API

### Chat

**POST** `/api/chat`
```json
{
  "prompt": "Crie uma meta descrição para um artigo sobre SEO local",
  "session_id": "uuid-da-sessao",
  "title": "Primeiras 6 palavras do prompt"
}
```
Resposta:
```json
{ "response": "texto em markdown..." }
```
> `title` só precisa ser enviado na primeira mensagem de uma sessão nova.

### Sessões

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/sessions` | Lista todas as sessões (id, título, updated_at) |
| `GET` | `/api/sessions/<id>` | Retorna sessão com últimas 15 mensagens |
| `PATCH` | `/api/sessions/<id>/title` | Renomeia uma sessão |
| `DELETE` | `/api/sessions/<id>` | Remove uma sessão |

### Histórico legado (mantido para compatibilidade)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/history/save` | Salva histórico na coleção `veo_histories` |
| `GET` | `/api/history/list` | Lista históricos salvos |
| `GET` | `/api/history/get?title=...` | Recupera um histórico pelo título |

---

## Configuração do Google Cloud Storage (para geração de imagens)

1. Crie um bucket no [Google Cloud Console](https://console.cloud.google.com/storage):
   ```bash
   gsutil mb -p [PROJECT_ID] -l us-central1 gs://monveo-seo-images
   gsutil iam ch allUsers:objectViewer gs://monveo-seo-images
   ```
2. Garanta que a service account tem o papel **Storage Object Admin** no bucket.
3. Se quiser usar um nome de bucket diferente, defina a variável `GCS_BUCKET`.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | `google_auth.json` | Caminho para o JSON da service account (backend local; no Docker o compose define `/secrets/google_auth.json`) |
| `MONVEO_GOOGLE_APPLICATION_CREDENTIALS` | `./backend/google_auth.json` | Caminho **no host** usado pelo `docker-compose` para montar o volume da chave |
| `GCS_BUCKET` | `monveo-seo-images` | Nome do bucket GCS para armazenar imagens geradas |

---

## Personalização

- **Trocar o modelo de chat**: edite a constante `GEMINI_MODEL` (por exemplo `"gemini-2.5-pro"`) em `backend/chat_app.py`. O cliente é criado com `genai.Client(vertexai=True, project=..., location=..., credentials=...)`.
- **Trocar o modelo de imagem**: edite `IMAGEN_MODEL = "imagegeneration@006"` em `backend/image_agent.py` (ex: `"imagen-3.0-generate-001"` se disponível)
- **Ajustar o prompt SEO**: edite a constante `SEO_SYSTEM_PROMPT` em `backend/chat_app.py`
- **Ajustar detecção de pedidos de imagem**: edite os padrões `_IMAGE_VERBS` e `_IMAGE_NOUNS` em `backend/chat_app.py` (função `_wants_image`)
- **Alterar a porta do frontend**: edite `ports` no `docker-compose.yml`
