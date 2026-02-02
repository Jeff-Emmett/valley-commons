# Valley of the Commons

Landing page and interactive game terminal for the Valley of the Commons project by Commons Hub.

## Overview

**Our valley is at a crossroads.** Once shaped by industry, it is now quietly deserting: businesses have closed, jobs are gone, young people leave. Yet beneath this surface of decline lies a rare constellation of opportunity. Just an hour from Vienna, with Europe's cleanest water flowing from the springs next door, surrounded by fertile land and affordable real estate, the Rax valley could become something else entirely: a prototype of future living.

With the **commons hub** already established as a growing engine for community, events, and innovation, the immediate next step is expansion into an **Event Campus**. The bigger goal, however, is establishing a **Valley of the Commons**: a place where cooperative housing, cosmo-local production, and systemic resilience converge into a living laboratory of post-capitalism.

## Why here, why now?

Across Europe, villages like ours have been emptying out. Younger generations move to the cities, industries collapse, and what remains are elderly residents, shuttered factories, and a crumbling social fabric. Meanwhile, the digital nomad movement, the rise of smart villages, and the accelerating meta-crisis point towards a different trajectory: people are looking for ways out of the metropolis, towards self-sufficient and regenerative forms of life.

Our setting is uniquely well-suited for this transition:

- **Resilient resources:** The surrounding mountains cool the air and provide Vienna's drinking water, while the valleys in between contain fertile land.
- **Space to grow:** An abundance of vacant houses, commercial spaces and agricultural lots makes expansion affordable and welcomed by locals.
- **Connectivity:** One hour by train to Vienna and 90 minutes to the airport position us right at the center of Europe's rail and air connections.

With local conditions ripe and global pressures rising, it's time to turn opportunity into action and start building. The future is shaped by the actions we take today.

## From hub to valley

The **commons hub** already anchors this process. Battle-tested as an event venue and guesthouse, it hosts everything from collaborative finance conferences, solarpunk meetups, and activist gatherings to academic workshops and prototyping sessions. To an emerging Valley of the Commons, it provides:

- **An economic engine**: providing jobs, visibility, and a constant stream of curious people seeking alternatives to the status quo;
- **A platform for entrepreneurship**: supporting new event series, research projects, product prototyping, and startup incubation;
- **A beacon for metamodern thought and imagination**: holding space for narratives that orient us beyond collapse.

## Housing the future

A key pillar of the valley will be housing — not "smart homes" full of gadgets, but dwellings designed for the real challenges of the 21st century: climate change, resource constraints, and hyper-mobile lifestyles. We envision:

- **Renovated houses** integrating state-of-the-art sustainable living concepts;
- **Cooperative ownership**: from permanent co-housing to time-share models and shorter-term rentals;
- **Distributed governance**: each house organized by its residents, following the principle of subsidiarity.

The **commons hub GmbH** is a pragmatic bootstrap, but the valley itself will be **community-owned and self-governed**. Our role is to provide initial momentum — network, knowledge, infrastructure, and capital — then step back.

## Production and self-sufficiency

The Valley of the Commons won't just be a place to live — it will be a place to **collaboratively produce value** in diverse ways:

- **Digital production** in communal co-working spaces;
- **Physical production** in co-owned FabLabs seeking to develop innovative niche products and providing local manufacturing for community needs;
- **Basic needs provision**: 100% water and energy self-sufficiency asap, while gradually building food resilience through community farming.

In this way, production cycles will not only create a semi-autonomous local economy, but also build the capacity to provide for livelihoods and withstand future global disruptions.

## Governance and community

A key challenge in the political realm consists of balancing **local autonomy** with **collective coherence**, while also rebalancing the relationship between capital and labor through cooperative ownership and participatory governance. Guided by the principle of subsidiarity, we envision:

- Co-owned and self-governed **houses and productive units**;
- **Village-wide commons** coordinated through collectively chosen mechanisms;
- **Integration with municipal politics** based on mutual recognition and complementarity.

## Announcing: Popup Village 2026

For now, the Valley of the Commons remains a vision, inspired by conversations among commons-oriented networks, deep adaptation thinkers, and p2p communities preparing for civilizational transition. To make it real, it needs future commons villagers to step in.

In 2026, we plan a **4–6 week popup village** — exploring housing, governance, production, and the valley itself, with the goal of turning vision into concrete plans.

**Michel Bauwens**, eminent Commons and P2P scholar, is on board, bringing his vision of a shift toward a commons-based civilization and experience with cosmo-local production. Veterans in mutual credit, community currencies, and housing coops are planning local research projects, while community leaders from Web3 co-livings and ecovillages provide guidance to **help lay the foundations of the Valley of the Commons**.

The organizing team includes veterans of **Zuzalu** and other "zu-villages." Together, we will explore not only what is possible, but what it feels like to live in a valley oriented around the commons.

## A growing campus, a growing commons

The immediate next step on this journey is the expansion of the hub into **a monastery-like Event Campus** capable of hosting summits, exhibitions, and popups. To make this happen, we are running a **community lending campaign**, raising €200k in loans from our network to secure and renovate the buildings. **Over €80k have already been pledged**, with some lenders even donating their interest back to support future events.

Supporting **the church expansion lays the groundwork** for the Valley of the Commons — the first step toward a campus that could grow into a vibrant village.

## Get Involved

🌱 **Lend to us** – help bridge the final stretch of funding.

🙋‍♂️ **Pre-register** for the 2026 popup village.

✍️ **Write to** f.fritsch@commons-hub.at **to get involved** in the popup organization.

Together, we can turn vision into reality.

## Project Structure

```
votc/
├── index.html          # Main landing page
├── game.html           # Game terminal interface
├── privacy.html        # Privacy FAQ page
├── styles.css          # Landing page stylesheet
├── game.css            # Game page stylesheet
├── waitlist.js         # Waitlist form handler (client-side)
├── game.js             # Game terminal logic
├── package.json        # Node.js dependencies
├── vercel.json         # Vercel configuration
├── internal_thought.md # Game design context for AI
├── api/
│   ├── waitlist.js     # Serverless function for Google Sheets
│   └── share-to-github.js # Serverless function for GitHub sharing
├── refs/               # Internal documentation (gitignored)
├── README.md           # This file
├── commonshublogo.svg  # Commons Hub logo
└── valley.webp         # Hero image
```

## Features

- **Landing Page** - Event information and waitlist signup
- **Game Terminal** - Interactive Socratic dialogue with AI game master
- **Idea Sharing** - Share conversation excerpts to GitHub as structured ideas
- **Privacy-First** - No tracking, no cookies, no user accounts

## Setup

### Prerequisites

- Node.js 18.x+
- Vercel account (for deployment)
- Google Cloud account (for waitlist)
- Vercel AI Gateway API key (for game chat)
- GitHub Personal Access Token (for idea sharing)

### Installation

```bash
git clone https://github.com/understories/votc.git
cd votc
npm install
```

### Environment Variables

Create `.env` in the root directory (or set in Vercel dashboard):

**Waitlist:**
- `GOOGLE_SERVICE_ACCOUNT` - Google Service Account JSON (string)
- `GOOGLE_SHEET_ID` - Google Sheets spreadsheet ID
- `GOOGLE_SHEET_NAME` - Sheet name (default: 'Waitlist')

**Game Chat:**
- `GAME_INTELLIGENCE` or `AI_GATEWAY_API_KEY` - Vercel AI Gateway key (starts with `vck_`)
- `GAME_MODEL` - Model name (default: `mistral/devstral-2`)

**GitHub Sharing:**
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Repo owner (default: 'understories')
- `GITHUB_REPO` - Repo name (default: 'votc')
- `GITHUB_BRANCH` - Branch (default: 'main')
- `GITHUB_PATH` - Ideas path (default: 'build_game/ideas')
- `GITHUB_CONVERSATIONS_PATH` - Conversations path (default: 'build_game/conversations')

### Local Development

**Static pages only:**
```bash
python3 -m http.server 8000
# or: npx http-server
```

**Full functionality (with serverless functions):**
```bash
npx vercel dev
```

### Deployment

```bash
npm i -g vercel
vercel
# Set environment variables in Vercel dashboard
vercel --prod
```

## Waitlist Functionality

The site includes a waitlist form that securely stores email addresses in a private Google Sheet. The integration uses:

- **Frontend:** HTML form with JavaScript for submission handling
- **Backend:** Vercel serverless function (`/api/waitlist.js`) that acts as a secure proxy
- **Storage:** Google Sheets (private, accessible only to admins)

**Setup Instructions:** See `refs/google-sheets-setup.md` for detailed configuration steps.

**Security:** All Google Sheets credentials are stored in Vercel environment variables and never exposed to the client. The Google Sheet remains private even though the code is public.

## Game Terminal

The game terminal (`game.html`) provides an interactive Socratic dialogue interface where users can explore ideas about the Valley of the Commons with an AI game master. Features:

- **Socratic questioning** - The AI guides conversations through thoughtful questions
- **Idea sharing** - Users can share conversation excerpts or full conversations to GitHub
- **Privacy-first** - Conversations are not saved unless explicitly shared
- **Streaming responses** - Real-time text streaming for natural conversation flow

**Game Chat:** Uses Vercel AI Gateway with Mistral models. See `refs/llm-integration-plan-v2.1.md` for architecture details.

**Security:** All credentials stored in Vercel environment variables. No secrets in code.

## Design Notes

This landing page follows the design aesthetic of commons-hub.at:
- Clean, minimal design
- Uppercase headings
- Sticky CTA button that scrolls with the page
- Responsive layout
- Modern typography

## License

© 2025 Commons Hub

