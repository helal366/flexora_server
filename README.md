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
   ```bash
   git clone https://github.com/Programming-Hero-Web-Course4/b11a12-server-side-Helal366.git
   cd flexora-backend


#### 2. Install dependencies:

bash

npm install

#### 3. Create a .env file with required environment variables (see below).

#### 4. Run the server:

bash

npm start

#### 5. The server will run on the port specified in .env (default 4000).

## Environment Variables
### Create a .env file with the following keys:

PORT=5000
MONGODB_URI=your_mongodb_connection_string
FIREBASE_SERVICE_ACCOUNT_KEY=path_to_your_firebase_service_account_key.json

- **MONGODB_URI:** Your MongoDB connection string
- **FIREBASE_SERVICE_ACCOUNT_KEY:** Path to your Firebase Admin SDK service account JSON file

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
