import os
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

def ingest_documents():
    print("Loading documents...")

    loader = DirectoryLoader(
        "documents",
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"}
    )

    documents = loader.load()
    print(f"Loaded {len(documents)} documents")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ".", " ", ""]
    )

    chunks = text_splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks")

    print("Creating embeddings (first run downloads model ~90MB)...")

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    print("Saving to FAISS vector store...")

    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore.save_local("vectorstore")

    print("Done! Vector store saved to vectorstore/")
    print(f"Total chunks indexed: {len(chunks)}")

if __name__ == "__main__":
    ingest_documents()