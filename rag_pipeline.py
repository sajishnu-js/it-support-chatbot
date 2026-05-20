import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

load_dotenv()

def get_embeddings():
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    return embeddings

def load_vectorstore():
    embeddings = get_embeddings()
    vectorstore = FAISS.load_local(
        "vectorstore",
        embeddings,
        allow_dangerous_deserialization=True
    )
    return vectorstore

def get_llm():
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        api_key=os.getenv("GROQ_API_KEY")
    )
    return llm

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

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def query_rag(question: str):
    vectorstore = load_vectorstore()
    llm = get_llm()

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )

    retriever = vectorstore.as_retriever(
        search_kwargs={"k": 3}
    )

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

    # Get answer
    answer = rag_chain.invoke(question)

    # Get source documents separately
    docs = retriever.invoke(question)
    sources = []
    for doc in docs:
        source_name = doc.metadata.get("source", "Unknown")
        source_name = source_name.split("/")[-1]
        if source_name not in sources:
            sources.append(source_name)

    return {
        "answer": answer,
        "sources": sources
    }