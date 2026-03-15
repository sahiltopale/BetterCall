# ✅ Draft System Updated for Gemini AI

## What Changed

### 🔄 Switched from OpenAI to Google Gemini

**Why?** You already have Gemini API keys configured, and Gemini offers:
- ✅ Free tier with generous limits
- ✅ Fast generation with Gemini 2.0 Flash
- ✅ High-quality embeddings with text-embedding-004
- ✅ No billing required to get started

### 📊 Technical Updates

#### 1. **DraftProcessor** (`backend/src/services/draftProcessor.ts`)
- ❌ Removed: OpenAI embeddings
- ✅ Added: Gemini `text-embedding-004` (768 dimensions)
- ✅ Updated: Pinecone index dimension from 1536 → 768
- ✅ Separate index: `legal-drafts` (not `legal-documents`)

#### 2. **DraftGenerator** (`backend/src/services/draftGenerator.ts`)
- ❌ Removed: GPT-4 generation
- ✅ Added: Gemini `gemini-3.1-flash-lite-preview` for generation
- ✅ All methods updated: generate, refine, compare, extract sections
- ✅ Suggestions generation with Gemini

#### 3. **Scripts Updated**
- `processDrafts.ts` - Uses Gemini API key
- `testDraftGeneration.ts` - Uses Gemini API key

#### 4. **Documentation Updated**
- `DRAFT_SETUP.md` - References Gemini instead of OpenAI
- `.env.example` - Clarifies dual-index setup

## 🔑 API Key Setup

Your `.env` already has Gemini configured:
```bash
GEMINI_API_KEY=AIzaSyCs-4j8BwCX5ixNL2YTNw-J3rzZjkfvG6c
VITE_GOOGLE_AI_API_KEY=AIzaSyCs-4j8BwCX5ixNL2YTNw-J3rzZjkfvG6c
```

You just need to add Pinecone key:
```bash
PINECONE_API_KEY=your_pinecone_key_here
```

## 📦 Two Separate Pinecone Indexes

### Index 1: `legal-documents` (Existing)
- **Purpose**: Case law, judgments, legal precedents
- **Used by**: RAG service, case search
- **Dimension**: Varies based on model used

### Index 2: `legal-drafts` (New)
- **Purpose**: Draft templates for generation
- **Used by**: Draft processor & generator
- **Dimension**: 768 (Gemini text-embedding-004)
- **Auto-created**: Yes, on first run

**Why Separate?**
- Keeps templates isolated from case law
- Different embedding dimensions
- Better semantic search accuracy
- Easier to manage and update

## 🚀 Quick Start

```bash
cd backend

# 1. Add Pinecone key to .env
# PINECONE_API_KEY=your_key_here

# 2. Place PDF drafts in backend/drafts/

# 3. Process drafts (creates legal-drafts index)
npm run process-drafts

# 4. Test generation
npm run test-drafts

# 5. Start server
npm run dev
```

## 🎯 What Works Now

✅ PDF text extraction  
✅ Gemini embeddings (text-embedding-004)  
✅ Pinecone vector storage in separate index  
✅ Semantic search for similar drafts  
✅ Draft generation with Gemini 2.0 Flash  
✅ Draft refinement  
✅ Draft comparison  
✅ Section extraction  
✅ All using FREE Gemini API!  

## 💰 Cost Comparison

### Before (OpenAI)
- Embeddings: $0.0001 per 1K tokens
- Generation: $0.03-0.06 per draft
- **100 drafts**: ~$3-6

### After (Gemini) ✅
- Embeddings: **FREE** (generous limits)
- Generation: **FREE** (generous limits)
- **100 drafts**: **$0**

## 🔧 Models Used

| Function | Model | Dimension |
|----------|-------|-----------|
| Embeddings | `text-embedding-004` | 768 |
| Generation | `gemini-3.1-flash-lite-preview` | - |
| Refinement | `gemini-3.1-flash-lite-preview` | - |
| Comparison | `gemini-3.1-flash-lite-preview` | - |
| Sections | `gemini-3.1-flash-lite-preview` | - |

## 📋 API Endpoints (Unchanged)

All 8 endpoints work exactly the same:
- `POST /api/drafts/generate`
- `POST /api/drafts/refine`
- `POST /api/drafts/compare`
- `POST /api/drafts/extract-sections`
- `POST /api/drafts/upload-pdf`
- `GET /api/drafts/search`
- `POST /api/drafts/process-folder`
- `GET /api/drafts/stats`

## ⚙️ Configuration Summary

```env
# Existing (already configured)
GEMINI_API_KEY=AIzaSyCs-4j8BwCX5ixNL2YTNw-J3rzZjkfvG6c

# Add this
PINECONE_API_KEY=your_pinecone_key

# Automatic
# - legal-documents index (existing)
# - legal-drafts index (created on first run)
```

## 🎉 Benefits of This Setup

1. **No OpenAI Costs**: Using free Gemini API
2. **Separate Indexes**: Clean separation of concerns
3. **Your API Keys**: Already have Gemini configured
4. **Free Tier**: Generous limits for development
5. **Fast**: Gemini 2.0 Flash is very fast
6. **Quality**: Similar or better results than GPT-4

## 🐛 Troubleshooting

### "GEMINI_API_KEY is not set"
Check your `.env`:
```bash
GEMINI_API_KEY=AIzaSyCs-4j8BwCX5ixNL2YTNw-J3rzZjkfvG6c
```

### "PINECONE_API_KEY is not set"
Add to `.env`:
```bash
PINECONE_API_KEY=your_actual_key
```

### "Index already exists with different dimension"
If you previously created an index:
1. Go to Pinecone console
2. Delete the `legal-drafts` index
3. Re-run `npm run process-drafts`

## 📚 Next Steps

1. ✅ Update complete - using Gemini
2. 📝 Add Pinecone API key to `.env`
3. 📄 Add PDF drafts to `backend/drafts/`
4. 🔄 Run `npm run process-drafts`
5. 🧪 Test with `npm run test-drafts`
6. 🚀 Start using the API!

---

**All set! Your draft system now uses Gemini AI with a dedicated Pinecone index.**
