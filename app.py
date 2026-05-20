import threading
import uvicorn
from backend import app as fastapi_app
import os
import requests
import streamlit as st
from ingest import ingest_documents

# Auto-build vectorstore if it doesn't exist
# This runs automatically on Streamlit Cloud first startup
if not os.path.exists("vectorstore/index.faiss"):
    with st.spinner("Building knowledge base for first time... please wait 2 minutes..."):
        ingest_documents()

if "api_started" not in st.session_state:
    thread = threading.Thread(
        target=lambda: uvicorn.run(
            fastapi_app,
            host="0.0.0.0",
            port=8000,
            log_level="error"
        ),
        daemon=True
    )
    thread.start()
    st.session_state.api_started = True

st.set_page_config(
    page_title="IT Support Assistant",
    page_icon="🖥️",
    layout="centered"
)

st.title("🖥️ IT Support Assistant")
st.markdown("Ask any IT support question and get instant answers from our knowledge base.")
st.divider()

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if "sources" in message and message["sources"]:
            st.caption(f"Sources: {', '.join(message['sources'])}")

question = st.chat_input("Type your IT question here...")

if question:
    with st.chat_message("user"):
        st.markdown(question)

    st.session_state.messages.append({
        "role": "user",
        "content": question
    })

    with st.spinner("Searching knowledge base..."):
        try:
            response = requests.post(
                "http://localhost:8000/ask",
                json={"question": question},
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                answer = data["answer"]
                sources = data["sources"]
            else:
                answer = "Sorry, something went wrong. Please try again."
                sources = []

        except requests.exceptions.ConnectionError:
            answer = "API is starting up. Please wait a moment and try again."
            sources = []

        except requests.exceptions.Timeout:
            answer = "Request timed out. Please try again."
            sources = []

    with st.chat_message("assistant"):
        st.markdown(answer)
        if sources:
            st.caption(f"Sources: {', '.join(sources)}")

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "sources": sources
    })

with st.sidebar:
    st.header("About")
    st.markdown("""
    This IT Support Assistant uses **RAG** (Retrieval Augmented Generation) to answer your questions from TechCore Solutions IT documents.

   
    **Documents loaded:**
    - IT Support SOP
    - Network Troubleshooting Guide
    - User Onboarding and Offboarding Guide
    - IT Security Policy
    - Microsoft 365 Administration Guide
    - Hardware and Asset Management Guide
    - Server and Infrastructure Guide
    - IT Helpdesk FAQ
    """)

    st.divider()

    if st.button("Clear Chat History"):
        st.session_state.messages = []
        st.rerun()

    st.divider()
    st.caption("Powered by LangChain + FAISS + Groq Llama3")