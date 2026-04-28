BetterCall – AI-Driven Legal Assistant
1. Overview

BetterCall is an AI-powered legal assistance platform designed to support legal professionals in research, case analysis, and document drafting. The system combines semantic retrieval with AI-based generation to provide accurate, context-aware, and source-grounded legal outputs.

It acts as a digital paralegal, helping reduce manual effort while maintaining reliability through validation mechanisms.

2. Key Features
AI-Powered Legal Research
Retrieves relevant case laws, statutes, and legal information using semantic search.
Judgment Summarization
Converts lengthy legal documents into concise, easy-to-understand summaries.
Good Law Check
Verifies whether cited legal cases are valid, outdated, or overruled.
Automated Legal Drafting
Generates structured drafts such as petitions, affidavits, notices, and agreements.
Semantic Search
Understands the meaning of queries rather than relying only on keywords.
User Workflow Support
Saves queries, drafts, and sessions for continuity.

3. System Architecture

The system follows a Retrieval-Augmented Generation (RAG) architecture:

User submits a legal query
Query is processed using NLP techniques
Relevant documents are retrieved using vector similarity
Retrieved context is passed to the AI model
AI generates response/draft based on grounded data
Validation layer checks legal correctness.

4. Technology Stack
Frontend
React.js (Vite)
Backend
Node.js
Express.js
Database
PostgreSQL (Drizzle ORM)
Vector Database
Pinecone (for semantic search)
Authentication
Firebase Authentication
AI Integration
Gemini / Large Language Models.

5. Installation & Setup
Prerequisites
Node.js installed
PostgreSQL database
Pinecone API key
Firebase project setup
Steps

Clone the repository

git clone https://github.com/your-repo/bettercall.git
cd bettercall

Install dependencies

npm install

Configure environment variables
Create a .env file and add:

DATABASE_URL=
PINECONE_API_KEY=
GEMINI_API_KEY=
FIREBASE_CONFIG=

Run the backend

npm run server

Run the frontend

npm run dev

6. Usage
Enter a legal query in natural language
System retrieves relevant legal data
View summarized results and case references
Generate legal drafts based on input
Validate case law using Good Law Check

7. Project Structure
bettercall/
│── frontend/
│── backend/
│── services/
│   ├── ragService.ts
│   ├── draftGenerator.ts
│   ├── indiaKanoonService.ts
│── database/
│── config/
│── README.md

8. Evaluation Metrics
Precision & Recall – Accuracy of retrieved legal documents
Response Time – Speed of query processing
Groundedness – Output supported by legal sources
Draft Utility – Quality of generated legal drafts.

9. Limitations
Depends on quality and freshness of legal data
Cannot replace professional legal judgment
Limited to Indian legal domain
Requires continuous updates for accuracy.

10. Future Enhancements
Multilingual support
Voice-based interaction
Integration with court databases
Advanced legal analytics and prediction.

11. Contributors
Sebin Sebastian
Darsh Shetty
Rushil Raul
Sahil Topale

Guide: Ms. Dhanashri Lamane

12. License

This project is developed for academic purposes. Licensing terms can be updated as required.
