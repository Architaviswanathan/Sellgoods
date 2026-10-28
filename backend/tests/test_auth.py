import os
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-auth-tests"
os.environ["FRONTEND_ORIGIN"] = "http://127.0.0.1:5173"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


class AuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(bind=cls.engine, autoflush=False, expire_on_commit=False)
        cls.client = TestClient(app)

        def override_get_db():
            database = cls.session_factory()
            try:
                yield database
            finally:
                database.close()

        app.dependency_overrides[get_db] = override_get_db

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls.client.close()
        cls.engine.dispose()
        Path("sellgoods-auth-test.db").unlink(missing_ok=True)

    def test_signup_login_and_current_user(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={"name": "Aanya Sharma", "email": "Aanya@campus.edu", "password": "campus-password-123"},
        )
        self.assertEqual(signup.status_code, 201)
        token = signup.json()["access_token"]
        self.assertEqual(signup.json()["user"]["email"], "aanya@campus.edu")

        login = self.client.post(
            "/api/auth/login",
            json={"email": "aanya@campus.edu", "password": "campus-password-123"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["name"], "Aanya Sharma")

        current_user = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.json()["id"], signup.json()["user"]["id"])

    def test_duplicate_email_is_rejected(self) -> None:
        payload = {"name": "Student", "email": "student@campus.edu", "password": "campus-password-123"}
        self.assertEqual(self.client.post("/api/auth/signup", json=payload).status_code, 201)
        duplicate = self.client.post("/api/auth/signup", json=payload)
        self.assertEqual(duplicate.status_code, 409)

    def test_wrong_password_and_missing_token_are_rejected(self) -> None:
        self.client.post(
            "/api/auth/signup",
            json={"name": "Student", "email": "student@campus.edu", "password": "campus-password-123"},
        )
        login = self.client.post(
            "/api/auth/login",
            json={"email": "student@campus.edu", "password": "not-the-password"},
        )
        self.assertEqual(login.status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_listing_created_by_one_user_is_visible_to_another(self) -> None:
        seller_response = self.client.post(
            "/api/auth/signup",
            json={"name": "Senior Student", "email": "seller@campus.edu", "password": "campus-password-123"},
        )
        buyer_response = self.client.post(
            "/api/auth/signup",
            json={"name": "Junior Student", "email": "buyer@campus.edu", "password": "campus-password-456"},
        )
        seller_token = seller_response.json()["access_token"]
        buyer_token = buyer_response.json()["access_token"]

        created = self.client.post(
            "/api/auctions",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={
                "title": "Engineering textbooks",
                "category": "Books",
                "condition": "Good",
                "description": "Clean engineering books with a few pencil notes.",
                "starting_price": 250,
                "increment": 25,
                "ends_at": "2030-01-01T12:00:00Z",
            },
        )
        self.assertEqual(created.status_code, 201)

        marketplace = self.client.get("/api/auctions", headers={"Authorization": f"Bearer {buyer_token}"})
        self.assertEqual(marketplace.status_code, 200)
        self.assertEqual(len(marketplace.json()), 1)
        self.assertEqual(marketplace.json()[0]["title"], "Engineering textbooks")
        self.assertEqual(marketplace.json()[0]["seller"], "Senior Student")
        self.assertEqual(marketplace.json()[0]["price"], 250)

    def test_seller_can_see_persistent_bidder_and_leading_amount(self) -> None:
        seller_response = self.client.post(
            "/api/auth/signup",
            json={"name": "Listing Owner", "email": "owner@campus.edu", "password": "campus-password-123"},
        )
        bidder_response = self.client.post(
            "/api/auth/signup",
            json={"name": "Interested Buyer", "email": "buyer@campus.edu", "password": "campus-password-456"},
        )
        seller_token = seller_response.json()["access_token"]
        bidder_token = bidder_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {seller_token}"}
        listing = self.client.post(
            "/api/auctions",
            headers=headers,
            json={
                "title": "Used textbook",
                "category": "Books",
                "condition": "Good",
                "description": "A clean copy ready for the next student.",
                "starting_price": 250,
                "increment": 25,
                "ends_at": "2030-01-01T12:00:00Z",
            },
        ).json()

        too_low = self.client.post(
            f"/api/auctions/{listing['id']}/bids",
            headers={"Authorization": f"Bearer {bidder_token}"},
            json={"amount": 249},
        )
        self.assertEqual(too_low.status_code, 422)

        bid = self.client.post(
            f"/api/auctions/{listing['id']}/bids",
            headers={"Authorization": f"Bearer {bidder_token}"},
            json={"amount": 250},
        )
        self.assertEqual(bid.status_code, 201)

        owner_listings = self.client.get("/api/auctions", headers=headers).json()
        owned_listing = next(item for item in owner_listings if item["id"] == listing["id"])
        self.assertEqual(owned_listing["seller_id"], seller_response.json()["user"]["id"])
        self.assertEqual(owned_listing["bids"][0]["bidder"], "Interested Buyer")
        self.assertEqual(owned_listing["bids"][0]["amount"], 250)

        edit_after_bid = self.client.patch(
            f"/api/auctions/{listing['id']}",
            headers=headers,
            json={"title": "Changed after bidding"},
        )
        self.assertEqual(edit_after_bid.status_code, 409)

        seller_bid = self.client.post(
            f"/api/auctions/{listing['id']}/bids",
            headers=headers,
            json={"amount": 300},
        )
        self.assertEqual(seller_bid.status_code, 403)


if __name__ == "__main__":
    unittest.main()
