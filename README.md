# 🖥️ IT Support RAG Chatbot

An AI-powered IT Support Assistant built using Retrieval Augmented Generation (RAG). Ask any IT support question and get instant, accurate answers sourced directly from company knowledge base documents.

## 🔗 Live Demo
👉 [Try the live app here](https://it-support-chatbot-fgafzd95dcayvhrtyypopp.streamlit.app) 

---

## 🧠 How It Works

```
User Question
     ↓
Convert to vector embedding
     ↓
Search FAISS vector database
     ↓
Retrieve top 3 relevant document chunks
     ↓
Send chunks + question to Llama3 (via Groq)
     ↓
Generate grounded answer with source citation
```

The LLM only answers from the indexed documents — it cannot hallucinate or use outside knowledge. If the answer is not in the documents, it says so and redirects to the helpdesk.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| LLM | Llama3-70b via Groq API (free) |
| RAG Framework | LangChain |
| Vector Database | FAISS (local) |
| Embeddings | HuggingFace all-MiniLM-L6-v2 |
| Backend | FastAPI |
| Frontend | Streamlit |
| Language | Python 3.13 |

---

## 📄 Knowledge Base Documents

The chatbot answers questions from 8 IT support documents:

- IT Support Standard Operating Procedures
- Network Troubleshooting Guide
- User Onboarding and Offboarding Guide
- IT Security Policy
- Microsoft 365 Administration Guide
- Hardware and Asset Management Guide
- Server and Infrastructure Management Guide
- IT Helpdesk FAQ

---

## 💬 Example Questions

```
How do I reset a user's Active Directory password?
What should I do if I suspect a phishing email?
How do I onboard a new employee?
What is the escalation process for a P1 incident?
How do I connect to the company VPN?
What is the password policy?
How do I set up MFA?
My laptop is running slow. What should I do?
How do I create a shared mailbox?
What should I do if my computer has malware?
```

---

## 🔒 Key Features

- **Grounded answers** — LLM only answers from indexed documents, no hallucination
- **Source citations** — every answer shows which document it came from
- **Honest fallback** — redirects to helpdesk when answer is not in documents
- **Conversation memory** — maintains chat history within the session
- **Clean architecture** — FastAPI backend and Streamlit frontend separated

---

