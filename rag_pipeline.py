import os

from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_google_genai import ChatGoogleGenerativeAI

from ingest import get_embeddings

load_dotenv()


def load_vectorstore():
    embeddings = get_embeddings()
    vectorstore = FAISS.load_local(
        "vectorstore",
        embeddings,
        allow_dangerous_deserialization=True
    )
    return vectorstore


def get_llm():
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        temperature=0,
        api_key=os.getenv("GEMINI_API_KEY"),
    )


PROMPT_TEMPLATE = """
You are an expert IT Support Assistant for TechCore Solutions.
Your job is to answer IT support questions accurately.

Use ONLY the information provided in the context below to answer.
If the answer is not in the context, say exactly:
"I don't have specific information about this in my documents.
Please contact IT Helpdesk at helpdesk@techcore.com or extension 1001."

Do NOT make up information.
Do NOT use knowledge outside of the provided context.
Be clear, concise, and provide step-by-step instructions where relevant.

Context:
{context}

Question: {question}

Answer:
"""

# Same grounding rules as PROMPT_TEMPLATE, but allowed to supplement with
# general knowledge when the documents don't cover the question. Opt-in only
# (Settings "strict mode" off) — never the default.
RELAXED_PROMPT_TEMPLATE = """
You are an expert IT Support Assistant for TechCore Solutions.
Your job is to answer IT support questions accurately.

Prefer the information provided in the context below. If the context fully
answers the question, use it as the source of truth and stay consistent with it.
If the context is missing or incomplete, you may use your general IT knowledge
to fill the gaps, but clearly note when you are doing so.

Be clear, concise, and provide step-by-step instructions where relevant.

Context:
{context}

Question: {question}

Answer:
"""


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def _source_entries(scored_docs):
    """De-dupe scored (doc, score) pairs into one citation card per file."""
    sources, seen = [], set()
    for doc, score in scored_docs:
        raw_name = str(doc.metadata.get("source", "Unknown")).replace("\\", "/")
        filename = raw_name.split("/")[-1]
        if filename in seen:
            continue
        seen.add(filename)
        sources.append({
            "filename": filename,
            "ext": os.path.splitext(filename)[1].lower(),
            "snippet": doc.page_content[:280],
            "page": doc.metadata.get("page"),
            # FAISS returns an L2 distance (lower = more similar); convert to
            # a 0-1 "relevance" score that's intuitive to display in the UI.
            "score": round(1 / (1 + float(score)), 4),
        })
    return sources


def query_rag(question: str, k: int = 3, strict_mode: bool = True, vectorstore=None, llm=None) -> dict:
    vectorstore = vectorstore or load_vectorstore()
    llm = llm or get_llm()

    template = PROMPT_TEMPLATE if strict_mode else RELAXED_PROMPT_TEMPLATE
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])

    retriever = vectorstore.as_retriever(search_kwargs={"k": k})

    # Modern LCEL chain — replaces RetrievalQA
    # | is the pipe operator — chains steps together
    # RunnablePassthrough passes the question through unchanged
    rag_chain = (
        {
            "context": retriever | format_docs,
            "question": RunnablePassthrough()
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    answer = rag_chain.invoke(question)
    scored_docs = vectorstore.similarity_search_with_score(question, k=k)

    return {
        "answer": answer,
        "sources": _source_entries(scored_docs),
    }


def stream_rag(question: str, k: int = 3, strict_mode: bool = True, vectorstore=None, llm=None):
    """Generator version of query_rag for token-by-token streaming.

    Yields, in real order as each stage actually completes:
      ("retrieval", list)  — as soon as retrieval finishes, before the LLM is called
      ("token", str)       — for each chunk the LLM generates
      ("sources", list)    — once generation is complete (same entries as "retrieval")
    """
    vectorstore = vectorstore or load_vectorstore()

    scored_docs = vectorstore.similarity_search_with_score(question, k=k)
    sources = _source_entries(scored_docs)
    yield "retrieval", sources

    llm = llm or get_llm()
    template = PROMPT_TEMPLATE if strict_mode else RELAXED_PROMPT_TEMPLATE
    prompt = PromptTemplate(template=template, input_variables=["context", "question"])
    context = format_docs([doc for doc, _ in scored_docs])

    chain = prompt | llm | StrOutputParser()
    for chunk in chain.stream({"context": context, "question": question}):
        if chunk:
            yield "token", chunk

    yield "sources", sources
