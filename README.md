# Flexora Backend API

Backend server for **Flexora** — a food donation and charity management platform aimed at reducing food waste by connecting restaurants and charities.

---

## Table of Contents

- [Overview](#overview)  
- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Setup & Installation](#setup--installation)  
- [Environment Variables](#environment-variables)  
- [API Endpoints](#api-endpoints)  
- [Authentication & Authorization](#authentication--authorization)  
- [Database](#database)  
- [Error Handling](#error-handling)  
- [Contributing](#contributing)  
- [License](#license)  

---

## Overview

This backend provides RESTful API endpoints to handle:

- User role requests and transactions  
- Food donations management  
- Donation requests from charities  
- Reviews and favorites system  
- Secure authentication using Firebase tokens  

The backend interacts with a MongoDB database and verifies user identity and authorization via Firebase Admin SDK.

---

## Features

- Secure user authentication and role-based authorization  
- Manage donations: create, update, delete, feature, favorite, pickup confirmation  
- Charity requests management with accept/reject workflow and locking donations  
- Reviews system to rate and review donations/restaurants  
- Favorites system for users to bookmark donations  
- Aggregated queries for efficient data retrieval  
- Robust input validation and error handling  

---

## Tech Stack

- **Node.js** with **Express.js** for API routing  
- **MongoDB** as the primary database  
- **Firebase Admin SDK** for authentication and authorization  
- **Tailwind CSS** for minimal HTML branding page styling  
- Other dependencies: `cors`, `dotenv`, `mongodb`, etc.

---

## Setup & Installation

#### 1. Clone the repo:

```
git clone https://github.com/Programming-Hero-Web-Course4/b11a12-server-side-Helal366.git
cd flexora-backend
```


#### 2. Install dependencies:
```
npm install
```

#### 3. Create a .env file with required environment variables (see below).
```
MONGODB_URI:"YOUR MONGODB URI"
STRIPE_SECRET_KEY:"YOUR STRIPE SECRET KEY"
FB_SERVICE_KEY:"YOUR FIREBASE SERVICE KEY"
```

#### 4. Run the server:
```
npm start
```

## API Endpoints
### Transactions

GET /transactions?email=user@example.com
Get transactions filtered by user email and purpose.

### Donations
- **POST** **/donations** — Add a new donation
- **GET** **/donations** — List donations (filterable by email, status)
- **GET** **/donations/:id** — Get donation details by ID
- **PATCH** **/donations/:id** — Update donation details
- **PATCH** **/donations/feature/:id** — Mark donation as featured
- **PATCH** **/donations/pickup/:id** — Confirm donation pickup
- **PATCH** **/donations/add_favorite/:donationId** — Add user favorite
- **DELETE** **/donations/:id** — Delete donation
- **GET** **/donations/featured** — Get featured donations
- **GET** **/donations/details/:id** — Get detailed donation info


   