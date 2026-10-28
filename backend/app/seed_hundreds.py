"""
seed_hundreds.py — Generates 120+ realistic collegiate auction lots for QuadBid campus marketplace.
Run with: python -m app.seed_hundreds
"""

import random
from datetime import datetime, timedelta, timezone

from .database import Base, SessionLocal, engine
from .models import User, Listing, Bid, Question
from .services.listing_service import rupees_to_paise

# Curated Unsplash images for each category
PHOTO_SETS = {
    "cycle": [
        "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1511994298241-608e28f14fde?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505705694340-019e1e335916?auto=format&fit=crop&w=800&q=80",
    ],
    "calculator": [
        "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1564865878688-9a244444042a?auto=format&fit=crop&w=800&q=80",
    ],
    "books": [
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80",
    ],
    "electronics": [
        "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    ],
    "other": [
        "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    ],
}

STUDENT_PROFILES = [
    ("Arun V", "arunv.21cse@kongu.edu", "21CSR014", "CSE", 4),
    ("Deepak M", "deepakm.22aim@kongu.edu", "22ALR031", "AIM", 3),
    ("Kavya S", "kavyas.21ece@kongu.edu", "21ECR078", "ECE", 4),
    ("Ganesh Kumar", "ganeshk.23it@kongu.edu", "23ITR045", "IT", 2),
    ("Swetha P", "swethap.22mech@kongu.edu", "22MER090", "MECH", 3),
    ("Naveen Raj", "naveenr.21eee@kongu.edu", "21EER052", "EEE", 4),
    ("Bhavana N", "bhavanan.23civil@kongu.edu", "23CER019", "CIVIL", 2),
    ("Vigneshwaran K", "vigneshk.22chem@kongu.edu", "22CHR034", "CHEMICAL", 3),
    ("Harini M", "harinim.21aim@kongu.edu", "21ALR022", "AIM", 4),
    ("Santhosh T", "santhosht.22cse@kongu.edu", "22CSR140", "CSE", 3),
]

# 120+ Product Templates with collegiate realism
PRODUCT_TEMPLATES = [
    # ── CYCLES (25 items) ──
    ("Hero Sprint Pro 21-Speed Mountain Cycle", "cycle", "good", 1600, 50, "Shimano Tourney 21 gears, dual disc brakes, front shock absorber. Perfect for daily commute from Dhaurani hostel to mechanical quad."),
    ("Btwin Rockrider 340 Trail Edition", "cycle", "like_new", 2800, 100, "Used for 1 semester only. 26-inch wheels, lightweight alloy frame, upgraded gel saddle. Helmet and heavy cable lock included."),
    ("Hercules Roadeo Hardliner 26T", "cycle", "fair", 1200, 50, "Sturdy campus cycle with 7-speed rear derailleur. New rear brake pads installed. Smooth pedal motion."),
    ("Firefox Tremor Hybrid Alloy Cycle", "cycle", "good", 2400, 100, "Lightweight 700c alloy frame hybrid. Excellent speed for moving across the vast Kongu campus."),
    ("Hero Street Rider Single Speed with Front Basket", "cycle", "good", 950, 25, "Zero maintenance single-speed bike. Equipped with front metal basket for lab manuals and water bottles."),
    ("Atlas Ultimate 26-Inch Campus Cruiser", "cycle", "fair", 800, 25, "Rugged steel frame, brand new tubes. Perfect low-cost transport between Hostel 3 and Canteen."),
    ("Mach City iBike Single Speed", "cycle", "like_new", 1900, 50, "Matte black minimalist city bike. Very lightweight, smooth rolling bearings. Only 8 months old."),
    ("Montra Madrock 29T Big-Wheel MTB", "cycle", "good", 3200, 100, "29-inch wheels conquer campus speed bumps effortlessly. Disc brakes, Shimano Altus shifting."),
    ("BSA Photon City Cycle with Rear Carrier", "cycle", "good", 1100, 50, "Comes with heavy rear luggage carrier for carrying drafting boards and project prototypes."),
    ("Hero Kyoto 26T Hybrid Bicycle", "cycle", "good", 1450, 50, "Comfortable upright riding posture. Recently greased bottom bracket and oiled chain."),
    ("Btwin Riverside 120 Hybrid", "cycle", "like_new", 2600, 100, "8-speed Microshift grip shifter. Super smooth tires for campus tarmac roads. Like new condition."),
    ("Hercules Top Gear 18-Speed Commuter", "cycle", "fair", 1000, 25, "Dependable 18-speed gear setup. New hand grips and bell. Ready to ride immediately."),
    ("Avon Gen X 26T Mountain Bike", "cycle", "good", 1300, 50, "Front suspension fork, broad knobby tires. Moving hostels and need to sell quickly."),
    ("Leader Scout 26T Single Speed MTB", "cycle", "like_new", 1500, 50, "Bought last semester. Sleek neon graphics, dual V-brakes with crisp stopping power."),
    ("Decathlon Tilt 120 Folding Bike", "cycle", "good", 3500, 100, "Folds in 30 seconds! Can be stored inside hostel room directly. Ideal for campus students without bike stand parking."),
    ("Firefox Rapide 21S Alloy Hybrid", "cycle", "good", 2900, 100, "Double-walled alloy rims, Tektro brakes, Shimano Tourney TX groupset. Serviced at Decathlon."),
    ("Hero Octane 26T Aluminum MTB", "cycle", "fair", 1250, 50, "Aircraft-grade aluminum frame. Lightweight and rust-free. Minor cosmetic scratches on fork."),
    ("Hercules Rodeo A100 VX Disc", "cycle", "good", 1750, 50, "Youthful styling with front disc brake and dual suspension setup. Good tire tread depth."),
    ("Kross Maximus 26T Dual Suspension", "cycle", "fair", 1150, 25, "Plush dual suspension absorbs rough campus pavements. Free numeric combination lock included."),
    ("Urban Terrain UT1000 21-Speed MTB", "cycle", "like_new", 2300, 50, "Includes free tracking bell, mudguards, and high-pressure hand pump. Graduating senior lot."),
    ("Btwin MyBike 700c Classic", "cycle", "good", 1350, 50, "The indestructible Decathlon classic. 1-piece steel frame, zero maintenance cost, smooth hubs."),
    ("Hero Sprint Next 24T Gear Cycle", "cycle", "fair", 900, 25, "Compact 24-inch frame suitable for nimble commuting. New brake cables installed."),
    ("Hercules Flak 26T Sport Bike", "cycle", "good", 1400, 50, "Wide alloy handlebar for high control. Great condition, always parked in covered hostel stand."),
    ("Cosmic Elate 26T Alloy Mountain Bike", "cycle", "good", 2100, 100, "21-speed Shimano EF500 integrated shifters. Smooth gear shifts and sharp mechanical disc brakes."),
    ("Avon Elements 27.5T Trail Bike", "cycle", "like_new", 2700, 100, "27.5-inch modern wheels. Used sparingly on weekends. Comes with LED front night light."),

    # ── CALCULATORS (20 items) ──
    ("Casio fx-991EX ClassWiz (Natural Textbook Display)", "calculator", "like_new", 650, 25, "552 functions including matrix inversion, integration, equation solver. Essential for all engineering exams."),
    ("Casio fx-991CW Next-Gen ClassWiz", "calculator", "like_new", 850, 25, "The newest 2024 model with quad-density display, math box simulations, and spreadsheet solver."),
    ("Casio fx-991MS 2nd Edition Scientific Calculator", "calculator", "good", 380, 20, "Classic 401 function calculator. Approved by Anna University / autonomous controller of examinations."),
    ("Casio fx-82MS Non-Programmable Scientific Calculator", "calculator", "good", 250, 15, "Standard 240 functions. Dual-line display. Perfect for 1st year engineering physics & chemistry."),
    ("Casio fx-991ES Plus 2nd Edition (Matrix & Vector)", "calculator", "good", 520, 25, "417 functions. Solves simultaneous linear equations and 3x3 matrices. Protective hard slide case included."),
    ("Texas Instruments TI-36X Pro Scientific", "calculator", "like_new", 1100, 50, "MultiView display showing multiple calculations on screen. Highly sought after for competitive exams and GATE."),
    ("Casio fx-100MS 2-Line Display Calculator", "calculator", "fair", 280, 15, "Reliable engineering calculator with fraction operations and coordinate transformations."),
    ("Casio fx-570ES Plus Scientific Calculator", "calculator", "good", 480, 20, "Identical internal processor to 991ES Plus without solar panel. Pristine buttons and screen."),
    ("Sharp EL-W516X WriteView Scientific Calculator", "calculator", "good", 450, 20, "4-line WriteView display. Solves quadratic and cubic equations instantly. Crisp tactile keys."),
    ("Casio fx-991EX ClassWiz with Original Box & Manual", "calculator", "like_new", 720, 25, "Includes original packaging, quick start guide, and 3-year warranty card (1 yr remaining)."),
    ("Casio fx-82ES Plus Natural Display", "calculator", "good", 300, 15, "Natural textbook display for fractions and square roots. Great condition with battery replaced last month."),
    ("Casio fx-991ES (First Gen Classic Grey)", "calculator", "fair", 340, 20, "The venerable grey edition. Proven reliability through 4 years of AIM departmental exams."),
    ("Texas Instruments TI-30XIIS Solar Scientific", "calculator", "good", 500, 25, "Dual powered (solar and battery). Robust plastic keys with clear 2-line display."),
    ("Casio fx-991CW Calculator with Custom Screen Guard", "calculator", "like_new", 890, 30, "Screen protector applied on day 1. Scratchless display. Best calculator currently allowed in exam halls."),
    ("Casio fx-350MS Scientific Calculator", "calculator", "good", 220, 10, "Compact 2-line scientific calculator. Great backup unit for university semester practicals."),
    ("Casio fx-991EX ClassWiz (Carbon Fiber Skin)", "calculator", "good", 600, 25, "Features custom protective matte carbon skin. Clean screen, all 552 functions verified working."),
    ("Casio fx-95MS Scientific Calculator", "calculator", "fair", 200, 10, "Economical engineering calculator with statistical calculations and standard deviation solver."),
    ("Casio fx-991ES Plus (Spare Exam Unit)", "calculator", "good", 490, 20, "Kept as backup during final year exams. Pristine condition with fresh Maxell button cell."),
    ("Casio fx-82MS with Engineering Formula Cheatsheet Inside Case", "calculator", "good", 260, 15, "Includes printed calculus and Laplace transform formula stickers neatly affixed inside slide cover."),
    ("Casio fx-991EX ClassWiz High-Precision Math Unit", "calculator", "like_new", 680, 25, "Fast calculation engine for complex numbers and numerical derivatives. Highly responsive keypad."),

    # ── TEXTBOOKS & NOTES (25 items) ──
    ("Higher Engineering Mathematics by B.S. Grewal (44th Edition)", "books", "good", 350, 25, "The ultimate bible for sem 1-4 engineering mathematics. Includes solved Anna Univ question papers."),
    ("Introduction to Algorithms (CLRS) by Cormen, Leiserson, Rivest (3rd Ed)", "books", "good", 550, 30, "Classic computer science reference for data structures, dynamic programming, and graph algorithms."),
    ("Artificial Intelligence: A Modern Approach by Russell & Norvig", "books", "like_new", 620, 30, "Hardcover international edition. Comprehensive coverage of search, probabilistic reasoning, and ML."),
    ("Deep Learning by Ian Goodfellow, Yoshua Bengio, Aaron Courville", "books", "like_new", 700, 50, "MIT Press foundational deep learning textbook. Scratch-free pages, highlighted only with pencil."),
    ("Database System Concepts by Silberschatz, Korth & Sudarshan (6th Ed)", "books", "good", 380, 20, "Standard textbook for DBMS courses. Covers relational algebra, SQL, normalization, and indexing."),
    ("Computer Networking: A Top-Down Approach by Kurose & Ross", "books", "good", 420, 25, "Essential for network layer architecture, TCP/IP socket programming, and protocol analysis."),
    ("Microelectronic Circuits by Sedra & Smith (7th International Edition)", "books", "good", 480, 25, "Core reference for analog electronics, MOSFET amplifiers, and op-amp circuit design."),
    ("Operating System Concepts by Silberschatz (The Dinosaur Book - 9th Ed)", "books", "good", 400, 20, "Covers process scheduling, semaphores, deadlocks, and virtual memory management in depth."),
    ("Digital Design by M. Morris Mano & Michael Ciletti (5th Edition)", "books", "good", 320, 20, "Standard reference for Boolean algebra, combinational circuits, sequential flip-flops, and Verilog."),
    ("Signals and Systems by Alan V. Oppenheim & Alan S. Willsky", "books", "fair", 310, 15, "Classic text on Fourier transforms, Laplace, and Z-transforms for electrical and electronics engineers."),
    ("Computer Organization and Architecture by William Stallings (10th Ed)", "books", "good", 360, 20, "Covers pipelining, cache memory mapping, RISC/CISC architecture, and multicore systems."),
    ("Compiler Design: Principles, Techniques, and Tools (Dragon Book)", "books", "like_new", 540, 25, "Aho, Lam, Sethi, Ullman classic for lexing, parsing, symbol tables, and code generation."),
    ("Control Systems Engineering by I.J. Nagrath & M. Gopal", "books", "good", 330, 20, "Essential for root locus, Bode plots, state-space equations, and Nyquist stability criteria."),
    ("Engineering Mechanics by S. Timoshenko & D.H. Young", "books", "fair", 240, 15, "Foundational statics and dynamics text for 1st year mechanical and civil students."),
    ("Object-Oriented Programming in C++ by Robert Lafore", "books", "good", 280, 15, "Clear guide to OOP concepts, pointers, polymorphism, operator overloading, and templates."),
    ("Theory of Computation & Automata by Michael Sipser (3rd Edition)", "books", "like_new", 460, 20, "Crystal clear explanations of DFA, NFA, context-free grammars, and Turing machines."),
    ("Software Engineering by Roger S. Pressman (8th Edition)", "books", "good", 340, 20, "Agile development models, sprint planning, software metrics, and architectural design patterns."),
    ("Complete 3rd Sem AI & Machine Learning Textbook Bundle (4 Books)", "books", "good", 450, 25, "Bundle contains: Python for Data Analysis, Stats for Engineers, ML Basics, and Linear Algebra notes."),
    ("GATE 2025 Computer Science & IT Topic-Wise Solved Papers (Made Easy)", "books", "like_new", 480, 25, "34 years of previous solved questions with detailed step-by-step reasoning and shortcuts."),
    ("Electric Machinery Fundamentals by Stephen J. Chapman", "books", "good", 390, 20, "Covers transformers, induction motors, and synchronous generators with real problem sets."),
    ("A Textbook of Fluid Mechanics by Dr. R.K. Bansal", "books", "good", 370, 20, "Hydraulics, Navier-Stokes approximations, and fluid kinematic equations with worked derivations."),
    ("Complete Anna University 1st Year Chemistry & Physics Solved Question Bank", "books", "good", 190, 10, "Contains last 8 university exam papers with verified model answers. Guaranteed pass booster."),
    ("Principles of Communication Systems by Taub & Schilling", "books", "fair", 270, 15, "Analog & digital modulation, AM/FM, QPSK, and noise calculations in communication channels."),
    ("Heat and Mass Transfer by R.K. Rajput", "books", "good", 340, 20, "Conduction, convection, radiation, and heat exchanger thermal designs with SI unit charts."),
    ("Design of Machine Elements by V.B. Bhandari (4th Edition)", "books", "good", 410, 25, "Shafts, keys, bolted joints, and gear design charts according to PSG design data book."),

    # ── ELECTRONICS & ACCESSORIES (30 items) ──
    ("Logitech G304 Lightspeed Wireless Gaming Mouse", "electronics", "like_new", 850, 30, "Hero sensor, 12,000 DPI, 250 hours on single AA battery. Includes USB nano receiver extension."),
    ("Keychron K2 V2 Wireless Mechanical Keyboard (Gateron Brown)", "electronics", "like_new", 2900, 100, "Mac & Windows layout, Bluetooth 5.1 + wired USB-C, 75% compact form factor with tactile switches."),
    ("Ant Esports KM540 Ergonomic Gaming Keyboard & Mouse Combo", "electronics", "good", 650, 25, "Rainbow backlighting, braided cables, dedicated media hotkeys for coding and study sessions."),
    ("Baseus 65W GaN Multi-Port Fast Charger (2x USB-C + 1x USB-A)", "electronics", "like_new", 950, 40, "Charges laptop, phone, and powerbank simultaneously from a single hostel room power socket."),
    ("Mi 20,000mAh 18W Fast Charging Power Bank with Dual Output", "electronics", "good", 600, 25, "Keeps devices alive during long library study sessions and hackathons. Micro-USB + Type-C input."),
    ("Boat Rockerz 550 Over-Ear Wireless Headphones", "electronics", "good", 750, 25, "50mm dynamic drivers, 20-hour playback, plush memory foam ear cushions for noisy hostel study rooms."),
    ("Portronics 6-in-1 USB-C Hub with 4K HDMI & 100W PD Pass-through", "electronics", "like_new", 800, 30, "Connects modern Type-C laptops to college projector podiums and external lab monitors."),
    ("Zebronics ZEB-WAR Wired USB Gaming Mouse with RGB", "electronics", "good", 240, 15, "DPI switch (800-3200), gold plated USB connector, ergonomic thumb rest. Works great."),
    ("Cosmic Byte CB-GK-16 Firefly Mechanical Keyboard (Outemu Blue)", "electronics", "good", 1100, 50, "Tenkeyless compact size, vibrant per-key RGB, satisfying mechanical click for rapid typing."),
    ("Tukzer Aluminum Ventilated Laptop Stand (Foldable Riser)", "electronics", "like_new", 380, 20, "Prevents neck strain during all-night coding sprints. Lightweight aluminum alloy with travel pouch."),
    ("Realme Buds Wireless 2 Neo Bluetooth Neckband", "electronics", "good", 480, 20, "11.2mm bass boost driver, Type-C fast charging, magnetic instant connection. 17hr battery life."),
    ("Dell Pro Wireless Keyboard and Mouse KM5221W Combo", "electronics", "like_new", 1200, 50, "Up to 36 months battery life. Silent tactile keys, 4000 DPI adjustable optical mouse."),
    ("SanDisk Ultra Dual Drive Luxe 128GB (USB-C & USB-A)", "electronics", "like_new", 620, 25, "All-metal reversible flash drive for transferring OS images, CAD files, and semester project repos."),
    ("TP-Link AC750 Wireless Portable Travel Router & Wi-Fi Extender", "electronics", "good", 700, 25, "Boosts weak Wi-Fi signal in corner hostel rooms into a high-speed personal hotspot."),
    ("Deepcool Wind Pal Mini 15.6\" Laptop Cooling Pad", "electronics", "good", 350, 20, "140mm silent blue LED fan keeps high-power engineering laptops cool during ANSYS / SolidWorks renders."),
    ("OnePlus Bullets Wireless Z2 Bluetooth Earphones", "electronics", "good", 850, 30, "12.4mm drivers, 10-minute charge gives 20 hours playback, IP55 sweat resistance for gym and campus."),
    ("Redragon Kumara K552 RGB Mechanical Gaming Keyboard", "electronics", "good", 1350, 50, "Solid metal base construction, custom mechanical dust-proof switches. Very durable."),
    ("HP 150 Wireless Optical Mouse with Nano Receiver", "electronics", "like_new", 320, 15, "Ambidextrous design, smooth 1600 DPI optical sensor. Includes fresh Duracell battery."),
    ("Ambrane 100W Type-C to Type-C Braided Fast Charging Cable (2M)", "electronics", "like_new", 220, 10, "Extra long 2-meter length reaches top hostel bunk beds from wall plug. E-Marker chip installed."),
    ("Lenovo 300 FHD Webcam with Dual Stereo Microphones", "electronics", "like_new", 890, 30, "1080p 30FPS sensor with physical privacy slider. Perfect for campus placement interviews and meetings."),
    ("Redmi 10,000mAh Slim Power Bank with Dual USB Ports", "electronics", "good", 420, 20, "Anti-slip edge texture, supports 10W fast charging. Compact pocket-friendly form factor."),
    ("Zebronics 4-Port High Speed USB 3.0 Hub with Individual Switches", "electronics", "good", 280, 15, "Expands single laptop USB port into 4 slots with LED indicators for pen drives and dongles."),
    ("Artis S9 2.0 Multimedia Stereo USB Desktop Speakers", "electronics", "good", 340, 15, "Compact stereo sound for watching NPTEL lectures and coding videos in hostel study rooms."),
    ("JBL Go 2 Portable Waterproof Bluetooth Speaker", "electronics", "good", 950, 40, "5 hours playtime, IPX7 waterproof. Rich audio for weekend hostel gatherings."),
    ("Logitech K380 Multi-Device Bluetooth Keyboard", "electronics", "like_new", 1600, 50, "Switches seamlessly between laptop, tablet, and phone with a single tap. Round pebble keys."),
    ("Seagate One Touch 1TB External USB 3.0 Portable Hard Drive", "electronics", "good", 2400, 100, "Password protection with hardware encryption. Holds datasets, virtual machines, and semester archives."),
    ("Kreo Owl Full HD 1080P Autofocus Webcam with Ring Light", "electronics", "like_new", 1150, 50, "Built-in 3-level touch adjustable ring light ensures clear video during late night online interviews."),
    ("GIZGA Essentials Electronics Organizer Cable Pouch Bag", "electronics", "like_new", 250, 10, "Double-layer travel organizer for keeping all college chargers, cables, and flash drives untangled."),
    ("SpinBot BattleModz Mobile Gaming Claw Triggers & Thumb Sleeves", "electronics", "like_new", 180, 10, "Capacitive conduction triggers for weekend BGMI hostel matches. Smooth breathable sleeves."),
    ("Syska 4-Socket Power Strip Extension Board with 2m Heavy Cable", "electronics", "good", 290, 15, "Surge protection with universal sockets. Absolute necessity for shared hostel room study desks."),

    # ── CAMPUS DORM, LAB & TOOLS (25 items) ──
    ("Omega Engineering Mini Drafter with Sturdy Compass & Scales", "other", "good", 340, 15, "Essential for 1st year Engineering Graphics. Unbreakable stainless steel arms, smooth 360-degree protractor."),
    ("Kongu Engineering College Official Lab Coat (Size 40 - Male)", "other", "like_new", 220, 10, "Preshrunk white cotton with embroidered college department crest. Used in chemistry and workshop labs."),
    ("Kongu Engineering College Official Lab Apron (Size 38 - Female)", "other", "like_new", 200, 10, "Clean, stain-free white cotton lab apron. Perfect for incoming 1st/2nd year junior students."),
    ("Wooden Engineering Drawing Board (Half Imperial Size: 23\" x 16\")", "other", "good", 280, 15, "Seasoned pine wood with ebony working edge. Straight true edge for T-square and mini drafter mounting."),
    ("Pigeon 1.5L Stainless Steel Electric Kettle (1500W)", "other", "good", 450, 20, "Boils water and cooks hostel midnight Maggi noodles in 3 minutes. Automatic shut-off sensor."),
    ("Wipro Garnet 6W Rechargeable LED Desk Study Lamp", "other", "like_new", 380, 20, "3-step touch dimming (warm, neutral, cool white). Flexible gooseneck with 5-hour battery backup."),
    ("Prestige Induction Cooktop PIC 20.0 with Indian Menu Presets", "other", "good", 1100, 50, "Feather touch buttons, dual heat sensors, energy saver technology. Graduating senior dorm sale."),
    ("Wakefit Orthopedic Dual Comfort Foam Hostel Mattress (Single Bed)", "other", "good", 1200, 50, "Fits standard 72x36 campus cot. Reversible medium firm / medium soft comfort layers. Clean with cover."),
    ("Cello Infuse Glass Water Bottle 1000ml with Protective Neoprene Sleeve", "other", "like_new", 160, 10, "Borosilicate glass with carry loop. Keeps water fresh throughout full day engineering lectures."),
    ("Kuber Industries Foldable Heavy Nylon Hostel Laundry Hamper", "other", "good", 120, 10, "Pop-up mesh basket with handles. Folds flat when not in use. Clean and durable."),
    ("Camel Artists Water Colour 24-Shade Tube Set with Palette & Brushes", "other", "like_new", 210, 10, "Used for fine arts club competition. 90% paint remaining in all tubes."),
    ("Adjustable Ergonomic Mesh Office Study Chair for Dorm Room", "other", "good", 1400, 50, "Pneumatic height adjustment, 360-degree nylon caster wheels, lumbar back support for coding desks."),
    ("Godrej Ultra High-Security Brass Padlock with 4 Computerized Keys", "other", "like_new", 260, 15, "Hardened steel shackle for locking hostel room doors and personal cupboards during vacations."),
    ("Sturdy Multi-Layer Plastic Shoe Rack for Hostel Room Corridor", "other", "good", 190, 10, "4-tier collapsible rack keeps sports shoes and college formals organized neatly outside room."),
    ("Bajaj DX 7 1000W Lightweight Dry Iron with Non-Stick Soleplate", "other", "good", 320, 15, "Thermal fuse protection, German non-stick coating for pressing formal shirts before placement drives."),
    ("Milton Thermosteel Flip Lid Flask 1000ml (Hot & Cold for 24h)", "other", "good", 480, 20, "100% rust-proof stainless steel flask. Keeps chilled water cold during scorching Tamil Nadu summer exams."),
    ("Koh-I-Noor Technical Rotring Pen Set (0.2, 0.4, 0.8mm)", "other", "good", 350, 15, "High-precision drafting pens for technical drawings, architectural plans, and circuit schematic drafting."),
    ("Single Bed Floral Pattern Microfiber Bedspread with 2 Pillow Covers", "other", "like_new", 250, 10, "Freshly laundered 210 TC soft microfiber sheet. Fits college hostel beds snugly."),
    ("Milton Compact 3-Tier Insulated Tiffin Lunch Box with Carrier Bag", "other", "good", 240, 10, "Leak-proof stainless steel containers keep homemade lunches warm till afternoon break."),
    ("Solimo Foldable Wooden Bed Study Table with Cup Holder & iPad Slot", "other", "like_new", 340, 15, "Work from bed during winter revision. Features tablet docking groove and anti-slip legs."),
    ("Crompton Ozone 55-Litre Desert Air Cooler for Hostel Dorm", "other", "good", 2800, 100, "High air delivery with honeycomb pads and ice chamber. Absolute lifesaver for hostel summer months."),
    ("Sturdy Metal Book Stand / Document Holder with Adjustable Angles", "other", "like_new", 150, 10, "Holds heavy reference books (like B.S. Grewal or CLRS) upright while coding on laptop."),
    ("Dorm Heavy Blackout Window Curtains (Pair - 7 Feet with Metal Eyelets)", "other", "good", 280, 15, "Blocks scorching afternoon sunlight and keeps hostel room cool. High-density polyester weave."),
    ("Solimo 5-Piece Heavy Stainless Steel Kitchen Cookware Set for Hostel", "other", "good", 450, 20, "Saucepan, fry pan, and milk pot with stay-cool Bakelite handles. Perfect for self-cooking students."),
    ("Stanley 8-Meter Powerlock Heavy Duty Steel Measuring Tape", "other", "like_new", 180, 10, "Durable chrome case with belt clip. Essential for civil engineering surveying and surveying lab practicals."),
]


def seed_hundreds(custom_db_url=None):
    if custom_db_url:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        if custom_db_url.startswith("postgres://"):
            custom_db_url = custom_db_url.replace("postgres://", "postgresql://", 1)
        eng = create_engine(custom_db_url, pool_pre_ping=True)
        Base.metadata.create_all(bind=eng)
        SessionMaker = sessionmaker(bind=eng)
        db = SessionMaker()
    else:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()

    print("[*] Initializing campus users...")
    user_objects = []
    for name, email, roll, dept, year in STUDENT_PROFILES:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                google_id=f"demo_{roll.lower()}",
                name=name,
                email=email,
                roll_number=roll,
                department=dept,
                year=year,
                is_profile_complete=True,
                is_active=True,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        user_objects.append(u)

    print(f"[OK] {len(user_objects)} student profiles verified.")

    # Current listings count
    existing = db.query(Listing).count()
    print(f"[STATS] Current listings in database: {existing}")

    now = datetime.now(timezone.utc)
    created_count = 0

    print("[*] Seeding 120+ authentic campus auction lots...")

    for idx, (title, category, condition, starting_price, min_inc, description) in enumerate(PRODUCT_TEMPLATES):
        # Pick seller randomly from students
        seller = random.choice(user_objects)

        # Distribute closing times realistically:
        # - first 10 lots close very soon (within 1 to 4 hours) for live auction excitement
        # - next 40 close in 12 to 24 hours
        # - remainder close in 2 to 5 days
        if idx < 10:
            close_time = now + timedelta(hours=random.randint(1, 4), minutes=random.randint(5, 55))
        elif idx < 50:
            close_time = now + timedelta(hours=random.randint(8, 24), minutes=random.randint(0, 59))
        else:
            close_time = now + timedelta(days=random.randint(2, 5), hours=random.randint(1, 18))

        photos = [random.choice(PHOTO_SETS[category])]

        listing = Listing(
            seller_id=seller.id,
            title=title,
            category=category,
            condition=condition,
            description=description,
            starting_price_paise=rupees_to_paise(starting_price),
            min_bid_increment_paise=rupees_to_paise(min_inc),
            photos=photos,
            closes_at=close_time,
            status="active",
        )
        db.add(listing)
        created_count += 1

    db.commit()
    print(f"[SUCCESS] Successfully created {created_count} brand new active auction lots!")

    # Add realistic opening bids on first 25 lots to simulate active collegiate bidding wars
    print("[*] Simulating active opening bids on trending lots...")
    all_active = db.query(Listing).filter(Listing.status == "active").order_by(Listing.id.desc()).limit(35).all()

    for item in all_active:
        # 70% chance of having active bids
        if random.random() < 0.75:
            num_bids = random.randint(1, 5)
            # Pick a bidder who is NOT the seller
            available_bidders = [u for u in user_objects if u.id != item.seller_id]
            if not available_bidders:
                continue

            current_paise = item.starting_price_paise
            for b_idx in range(num_bids):
                bidder = random.choice(available_bidders)
                current_paise += item.min_bid_increment_paise * random.randint(1, 2)
                bid = Bid(
                    listing_id=item.id,
                    bidder_id=bidder.id,
                    amount_paise=current_paise,
                    created_at=now - timedelta(minutes=random.randint(5, 120)),
                )
                db.add(bid)

    db.commit()

    total_listings = db.query(Listing).count()
    total_bids = db.query(Bid).count()
    print(f"[DONE] Database now populated with {total_listings} total lots and {total_bids} active student bids!")
    db.close()


if __name__ == "__main__":
    import sys
    target_url = sys.argv[1] if len(sys.argv) > 1 else None
    seed_hundreds(target_url)
