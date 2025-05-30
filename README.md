# koyn-ai
System Architecture Overview
┌─────────────────────────────────────────────────────────────────┐
│                       Unified Frontend                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Gateway Layer                         │
└───────┬─────────────────────┬──────────────────────┬────────────┘
        │                     │                      │
        ▼                     ▼                      ▼
┌───────────────┐    ┌────────────────┐    ┌─────────────────┐
│ Stock Analysis│    │ Crypto Analysis│    │Sentiment Analysis│
│ (AI Hedge Fund)│    │    (Eliza)     │    │    (Nitter)     │
└───────┬───────┘    └────────┬───────┘    └────────┬────────┘
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Storage Layer                        │
└─────────────────────────────────────────────────────────────────┘



Project structure

financial-ai/
├── ai-hedge-fund/        # Original AI Hedge Fund repository
│   └── src/
│       └── api_endpoint.py  # New API endpoint for AI Hedge Fund
├── eliza/                # Original Eliza repository
│   └── packages/
│       └── core/
│           └── src/
│               ├── api/
│               │   └── crypto-analysis.js  # New crypto analysis API
│               └── server.js               # New Express server for Eliza
├── nitter/               # Original Nitter repository
├── src/
│   ├── api.js            # Modified version of Nitter's api.js
│   ├── server.js         # Main API Gateway server
│   └── services/         # Additional services
├── public/
│   ├── index.html        # Unified frontend
│   ├── css/
│   │   └── styles.css    # CSS styles
│   └── js/
│       └──

## Features

- **Unified Financial Analysis**: Analyze both stocks and cryptocurrencies in one platform
- **Social Sentiment Analysis**: Leverage Twitter data via Nitter to gauge market sentiment
- **Expert AI Agents**: Multiple AI agents analyze assets from different investment perspectives
- **Interactive Visualizations**: View price charts and analysis in an intuitive interface

## Prerequisites

- Node.js (v18 or higher)
- Python 3.9+
- Poetry (for AI Hedge Fund)
- API keys for OpenAI, Financial Datasets, etc.

## Installation

1. Clone the repository with submodules:
```bash
git clone --recurse-submodules https://github.com/yourusername/koyn-ai.git
cd koyn-ai
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Set up AI Hedge Fund:
```bash
cd ai-hedgefund
cp .env.example .env
# Edit .env with your API keys
poetry install
cd ..
```

4. Set up Eliza:
```bash
cd eliza
cp .env.example .env
# Edit .env with your API keys
pnpm install
cd ..
```

5. Create a .env file in the root directory:
```bash
cp .env.example .env
# Edit .env with your API keys
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to http://localhost:3000

## Project Structure

## Subscription and Verification System

The system includes a complete email verification and subscription management service that integrates with HubSpot.

### Features
- Email verification for subscriptions
- Secure verification code generation and validation
- HubSpot integration for contact management
- Separate verification API service for improved security

### Setup Instructions

1. Configure HubSpot integration:
   - See [HUBSPOT_SETUP.md](HUBSPOT_SETUP.md) for detailed instructions
   - Create a Private App in HubSpot with required scopes
   - Set up the required custom properties and email templates

2. Set required environment variables in your `.env` file:
   ```
   # Main API port
   PORT=3001
   
   # Verification API port
   VERIFICATION_PORT=3005
   
   # HubSpot integration
   HUBSPOT_ACCESS_TOKEN=your_private_app_access_token
   HUBSPOT_VERIFICATION_TEMPLATE_ID=12345678
   
   # For frontend (if using Vite)
   VITE_HUBSPOT_ACCESS_TOKEN=your_private_app_access_token
   VITE_HUBSPOT_VERIFICATION_TEMPLATE_ID=12345678
   ```

3. Start the services:
   ```bash
   ./start-services.sh
   ```
   This will start both the main API and verification API services.

### Testing the Verification System

1. Send a verification code:
   ```bash
   curl -X POST http://localhost:3005/api/verification/request \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. Verify the code:
   ```bash
   curl -X POST http://localhost:3005/api/verification/verify \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "code": "123456"}'
   ```

### Troubleshooting

If verification emails aren't being sent:
- Check if both API services are running (`ps aux | grep node`)
- Verify HubSpot credentials are correct
- Ensure the verification template ID is correctly set
- Check nginx configuration is routing verification requests correctly

If nginx isn't routing correctly:
- Confirm `/api/verification` and `/api/subscription` routes in `nginx-fix.conf`
- Restart nginx after any configuration changes

If verification codes aren't being validated:
- Codes expire after 10 minutes
- Maximum of 5 attempts per code
- Check the verification API logs for specific error messages

## 🔍 Grok API Live Search Integration

The platform now uses X.AI's Grok API for real-time sentiment analysis with local search backend as fallback. This provides:

- **Real-time data**: Live search capabilities for up-to-date social media sentiment
- **Better accuracy**: Grok's advanced understanding of financial markets and sentiment
- **Reliable fallback**: Automatic fallback to local search if Grok API is unavailable
- **High availability**: Ensures sentiment data is always available through dual-source approach
- **Cost efficiency**: Direct API integration without maintaining local search infrastructure
- **Scalability**: Handle more concurrent requests with cloud-based processing

### Setup

1. Get your API key from [X.AI Console](https://console.x.ai/)
2. Add to your `.env` file:
   ```
   GROK_API_KEY=your_xai_api_key_here
   # OR alternatively:
   XAI_API_KEY=your_xai_api_key_here
   ```
3. Test the integration:
   ```bash
   node test-grok-sentiment.js
   ```
4. Test the fallback functionality:
   ```bash
   node test-fallback-sentiment.js
   ```

### API Usage & Fallback Strategy

The sentiment analysis follows a **priority-based fallback approach**:

1. **Primary**: Grok API Live Search (if API key available)
   - Real-time social media posts about assets
   - Advanced financial sentiment understanding
   - Up-to-date market discussions

2. **Fallback**: Local Search Backend (`https://koyn.ai:3001/api/search`)
   - Cached/indexed social media content
   - Proven reliability and speed
   - Zero external dependencies

3. **Final Fallback**: Empty array (graceful degradation)
   - System continues functioning
   - No crashes or errors
   - Maintains API availability

### Benefits of Fallback Approach

- **🔄 High Availability**: Always returns sentiment data when possible
- **💰 Cost Control**: Falls back if Grok API becomes expensive
- **⚡ Performance**: Local search provides faster response times
- **🛡️ Reliability**: Never crashes due to external API failures
- **📊 Data Quality**: Grok provides best results, local ensures coverage

### Cost Optimization

- Limited to 30 posts per request to manage costs
- Focused search queries for relevant results
- Timeout handling to prevent hanging requests
- Automatic fallback to local search if Grok unavailable
- Smart parsing to extract maximum value from responses

### Models Used

- **grok-2-1212**: Primary model for reliable live search capabilities
- **Local Backend**: Fallback using proven local search infrastructure
- **Graceful Degradation**: Returns empty results if both sources fail