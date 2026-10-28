# Sellgoods

Campus essentials, passed on through transparent item-by-item auctions.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## What is here

- Search and filter live listings by category, condition, and maximum price.
- Listing creation with item details, a local photo, opening bid, increment, and auction duration.
- Per-item countdowns, public bid history, bid validation, and a 60-second anti-sniping extension for bids in the final 30 seconds.
- Item-specific buyer questions, saved auctions, browser notification permission, and a natural-language search assistant.
- Automatic bid limit controls and search alerts are represented in the interface.

## Demo limitations

This is a front-end prototype. Sample listings are in `src/App.tsx`; auction state is held in browser memory and resets on reload. Automatic bidding, search alerts, and notifications are UI demonstrations, not persistent services. The current photo selection creates a local browser preview URL. There is no sign-in, shared real-time bidding, server-side auction clock, seller approval or cancellation workflow, or handover record yet. Do not use this prototype for real transactions.

Before a real launch, connect a backend with campus authentication, persistent storage, server-enforced bid validation and closing, durable notifications, and seller outcome/handover workflows.