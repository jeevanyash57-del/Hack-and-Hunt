# Hack and Hunt — Event Competition Landing Page

A modern, responsive event competition landing page with a bold dark theme, vibrant gradient accents, glassmorphism cards, and smooth scroll animations.

## 🚀 Live Demo
Deployed on Vercel → **[View Live Site](https://hack-and-hunt.vercel.app)**

## 📋 Sections
1. Sticky Navigation Bar
2. Hero / Home Section
3. Event Timeline
4. Event Thought / Inspiration Quote
5. Event Overview
6. Prize Pool (Total)
7. Prize Breakdown (1st / 2nd / 3rd / Special)
8. Event Details (Date, Venue, Team Size, Fee, Prize)
9. Registration Section
10. General Competition Rules
11. FAQ (Accordion)
12. Event Coordinators

## 🎨 Design Features
- **Dark theme** — deep `#050812` background
- **Gradient accents** — Indigo → Purple → Pink
- **Glassmorphism cards** — `backdrop-filter: blur()` with hover glow
- **Scroll animations** — IntersectionObserver reveal with stagger
- **Animated background** — floating orbs, spinning rings, grid overlay
- **Typography** — Orbitron · Space Grotesk · Inter (Google Fonts)
- **Fully responsive** — mobile hamburger menu, fluid grids

## ✏️ Customization — Replace Placeholders

Open `index.html` and find-replace these tokens:

| Placeholder | Description |
|---|---|
| `[EVENT NAME]` | Your event name |
| `[DATE]` | Event date |
| `[TIME]` | Event time |
| `[VENUE]` | Venue name |
| `[CITY]` | City |
| `[PRIZE POOL]` | Total prize pool (e.g. ₹50,000) |
| `[1ST PRIZE]` | First place amount |
| `[2ND PRIZE]` | Second place amount |
| `[3RD PRIZE]` | Third place amount |
| `[SPECIAL PRIZE]` | Special mention amount |
| `[REGISTRATION FEE]` | Fee per team |
| `[REGISTRATION LINK]` | Google Form / Unstop / Devfolio link |
| `[START DATE]` | Registration opening date |
| `[DEADLINE DATE]` | Registration deadline |
| `[SHORTLISTING DATE]` | Shortlisting announcement date |
| `[EVENT DATE]` | Competition day date |
| `[RESULT DATE]` | Winner announcement date |
| `[SUBMISSION DEADLINE]` | Project submission deadline |
| `[Coordinator Name N]` | Coordinator full names |
| `[PHONE N]` | Coordinator phone numbers |
| `[EMAIL N]` | Coordinator email addresses |
| `[LINKEDIN N]` | Coordinator LinkedIn profile URLs |
| `[ORGANIZING BODY]` | Organizing club / department |

## 🛠️ Tech Stack
- Pure **HTML5 + CSS3 + Vanilla JS** — zero frameworks, zero build tools
- Google Fonts (loaded via CDN)
- No npm, no bundler, no dependencies

## ☁️ Deploy on Vercel

### Option 1 — Vercel Dashboard (Recommended)
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import this GitHub repository
3. Leave all settings as default (auto-detected as static)
4. Click **Deploy**

### Option 2 — Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

## 📁 File Structure
```
Hack-and-Hunt/
├── index.html      # Complete single-file landing page
├── vercel.json     # Vercel deployment config (security headers, caching)
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## 📄 License
MIT — free to use and customize for your event.
