# Sellgoods

Campus essentials, passed on through transparent item-by-item auctions.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Backend and PostgreSQL

The API uses FastAPI, SQLAlchemy, PostgreSQL, Argon2 password hashes, and signed bearer access tokens. Signup requires a name, valid email, and password with at least 10 characters. Set `CAMPUS_EMAIL_DOMAIN` in `backend/.env` to restrict signups to your institution.

1. Copy `backend/.env.example` to `backend/.env` and set a long random `JWT_SECRET`.
2. Install PostgreSQL locally, start the PostgreSQL service, and create a database named `sellgoods` (or update `DATABASE_URL` to match your local role and password).
3. Install dependencies with `python -m pip install -r backend/requirements.txt`.
4. Start the API from the repository root with `python -m uvicorn app.main:app --app-dir backend --reload`.
5. In another terminal, run the frontend with `npm run dev -- --host 127.0.0.1`.

The API health check is `/api/health`; FastAPI's interactive endpoint docs are at `/docs`. Configure `VITE_API_URL` if the API is not at `http://127.0.0.1:8000`. Listings are stored in PostgreSQL and returned to every authenticated student. Listing images are resized in the browser and stored with their auction record.

Run the auth tests from the repository root with `python -m unittest discover -s backend/tests -v`. They use in-memory SQLite and do not need PostgreSQL.

## What is here

- Search and filter live listings by category, condition, and maximum price.
- Listing creation with item details, a local photo, opening bid, increment, and auction duration.
- Per-item countdowns, public bid history, bid validation, and a 60-second anti-sniping extension for bids in the final 30 seconds.
- Persistent bids show the leading student's name and full public bid history in the seller workspace; sellers can manage their own listings by account ID.
- Item-specific buyer questions, saved auctions, browser notification permission, and a natural-language search assistant.
- Seller workspace to edit or cancel listings, approve or reject a winning price, and record confirmed or failed pickup outcomes.
- Automatic bid limit controls and search alerts are represented in the interface.

## Demo limitations

Authentication, listings, and bids are stored by the backend and shared between authenticated users. Automatic bidding, search alerts, and notifications are UI demonstrations, not persistent services. Listing photos are resized in the browser and stored in the listing record. Do not use this prototype for real transactions.

Before a real launch, add formal schema migrations, email verification and account recovery, secure production secret management, durable notifications, and fully persisted seller outcome/handover workflows. Use HTTPS and a secure token storage strategy in production.