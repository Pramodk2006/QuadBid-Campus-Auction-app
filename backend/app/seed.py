"""
seed.py — Populate realistic campus auction lots for demonstration.
Run via: python -m app.seed
"""

from datetime import datetime, timedelta, timezone
from .database import Base, SessionLocal, engine
from .models import User, Listing, Bid, Question
from .services.listing_service import rupees_to_paise
from .services.bidding_service import place_bid
from .services.question_service import create_question, answer_question
from .schemas import QuestionCreate, AnswerCreate

def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Create or get verified students
    students = [
        {
            "google_id": "demo_pramod",
            "name": "Pramod K",
            "email": "pramodk.23aim@kongu.edu",
            "roll_number": "23ALR070",
            "department": "AIM",
            "year": 3,
        },
        {
            "google_id": "demo_ravi",
            "name": "Ravi S",
            "email": "ravis.21cse@kongu.edu",
            "roll_number": "21CSE045",
            "department": "CSE",
            "year": 4,
        },
        {
            "google_id": "demo_karthik",
            "name": "Karthik M",
            "email": "karthikm.22itr@kongu.edu",
            "roll_number": "22ITR012",
            "department": "IT",
            "year": 3,
        },
        {
            "google_id": "demo_sneha",
            "name": "Sneha R",
            "email": "snehar.21ece@kongu.edu",
            "roll_number": "21ECE089",
            "department": "ECE",
            "year": 4,
        },
    ]

    user_objs = {}
    for st in students:
        user = db.query(User).filter(User.email == st["email"]).first()
        if not user:
            user = User(
                google_id=st["google_id"],
                name=st["name"],
                email=st["email"],
                roll_number=st["roll_number"],
                department=st["department"],
                year=st["year"],
                is_profile_complete=True,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        user_objs[st["roll_number"]] = user

    # 2. Check if listings already exist
    existing_count = db.query(Listing).count()
    if existing_count > 0:
        print(f"Database already contains {existing_count} listings. Skipping seed.")
        db.close()
        return

    now = datetime.now(timezone.utc)

    # Demo listings
    demo_listings = [
        {
            "seller_id": user_objs["21CSE045"].id, # Ravi S (senior)
            "title": "Hero Sprint Pro 21-Speed Mountain Cycle",
            "category": "cycle",
            "condition": "good",
            "description": "Graduating senior selling my trusted campus cycle. Dual disc brakes, 21-speed Shimano gears, sturdy front suspension. Ideal for riding between hostel and mechanical block. Serviced 2 weeks ago.",
            "starting_price": 1400.0,
            "min_bid_increment": 50.0,
            "closes_at": now + timedelta(hours=3, minutes=15),
            "photos": [
                "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80"
            ],
        },
        {
            "seller_id": user_objs["21ECE089"].id, # Sneha R (senior)
            "title": "Casio fx-991EX ClassWiz Scientific Calculator",
            "category": "calculator",
            "condition": "like_new",
            "description": "Natural textbook display, matrix/vector calculations, solar + battery powered. Used for university exams only. Clear protective slide cover included.",
            "starting_price": 450.0,
            "min_bid_increment": 20.0,
            "closes_at": now + timedelta(minutes=45), # Closing soon (< 1 hour)
            "photos": [
                "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80"
            ],
        },
        {
            "seller_id": user_objs["23ALR070"].id, # Pramod K
            "title": "Complete 3rd Sem AI & Machine Learning Textbook Bundle",
            "category": "books",
            "condition": "good",
            "description": "Standard university reference books: Pattern Recognition (Bishop), Mathematics for Machine Learning, plus printed laboratory lecture binders with solved problems.",
            "starting_price": 300.0,
            "min_bid_increment": 25.0,
            "closes_at": now + timedelta(hours=18),
            "photos": [
                "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80"
            ],
        },
        {
            "seller_id": user_objs["21CSE045"].id, # Ravi S
            "title": "Logitech G304 Lightspeed Wireless Mouse (with spare battery)",
            "category": "electronics",
            "condition": "like_new",
            "description": "Ultra-fast 1ms wireless response, HERO sensor, original box and USB extender. Great for CAD design, competitive gaming, and day-to-day coding in dorms.",
            "starting_price": 850.0,
            "min_bid_increment": 50.0,
            "closes_at": now + timedelta(hours=36),
            "photos": [
                "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80"
            ],
        },
        {
            "seller_id": user_objs["22ITR012"].id, # Karthik M
            "title": "Hostel Study Lamp & Ergonomic Laptop Cooling Stand",
            "category": "other",
            "condition": "good",
            "description": "3-stage brightness LED desk lamp with USB charging port + aluminum ventilated laptop riser. Packing light for semester break.",
            "starting_price": 200.0,
            "min_bid_increment": 15.0,
            "closes_at": now + timedelta(minutes=15), # Closing in 15 mins for sniper demo!
            "photos": [
                "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80"
            ],
        },
    ]

    for item in demo_listings:
        l = Listing(
            seller_id=item["seller_id"],
            title=item["title"],
            category=item["category"],
            condition=item["condition"],
            description=item["description"],
            starting_price_paise=rupees_to_paise(item["starting_price"]),
            min_bid_increment_paise=rupees_to_paise(item["min_bid_increment"]),
            closes_at=item["closes_at"],
            photos=item["photos"],
            status="active",
        )
        db.add(l)
        db.commit()
        db.refresh(l)

        # Add initial bids on the cycle and calculator lots
        if item["category"] == "cycle":
            place_bid(db, l.id, user_objs["23ALR070"], 1400.0) # Pramod bids 1400
            place_bid(db, l.id, user_objs["22ITR012"], 1500.0) # Karthik bids 1500

            # Seed realistic buyer questions & seller answers from mockups
            q1 = create_question(
                db, l.id, user_objs["23ALR070"],
                QuestionCreate(question_text="Does the rear disc brake squeak or need pad replacement?")
            )
            answer_question(
                db, l.id, q1["id"], user_objs["21CSE045"],
                AnswerCreate(answer_text="No, replaced the brake pads last month. You can test ride around the hostel quad porch before final handover approval.")
            )

            q2 = create_question(
                db, l.id, user_objs["22ITR012"],
                QuestionCreate(question_text="Is the frame size suitable for a student 5ft 8in tall?")
            )
            answer_question(
                db, l.id, q2["id"], user_objs["21CSE045"],
                AnswerCreate(answer_text="Yes, the saddle is quick-release adjustable. I am 5'9\" and rode it comfortably across campus.")
            )
        elif item["category"] == "calculator":
            place_bid(db, l.id, user_objs["23ALR070"], 450.0) # Pramod bids 450

            q3 = create_question(
                db, l.id, user_objs["23ALR070"],
                QuestionCreate(question_text="Is the solar sensor and textbook display crisp?")
            )
            answer_question(
                db, l.id, q3["id"], user_objs["21ECE089"],
                AnswerCreate(answer_text="Tested in semester finals, solar sensor crisp, original protective casing intact.")
            )

    print("Demo data seeded successfully with Kongu students, active lots, and live bids!")
    db.close()

if __name__ == "__main__":
    seed_demo_data()

