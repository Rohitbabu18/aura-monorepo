# Backend Understanding Guide (Node.js + Express + MongoDB)

This document explains **how the backend works**, **execution control flow**, and **why each important file exists**. It is written to help frontend (React Native) developers quickly understand and maintain the backend.

---

## 1. High-Level Architecture

```
React Native App
      |
      | HTTP (Axios)
      v
Express Server (Node.js)
      |
      | Routes
      v
Controllers
      |
      | Business Logic
      v
Models (Mongoose)
      |
      v
MongoDB Database
```

---

## 2. Execution Control Flow (Step-by-Step)

### Example: `GET /api/users/getAllUsers`

```
1. Client (From React/React native or any Frontend App or Postman)
   |
   |  GET /api/users/getAllUsers   [ call this api from frontend ]
   v

2. server.js
   - Starts server             [ request came ]
   - Connects MongoDB
   |
   v

3. app.js
   - Registers middlewares
   - Mounts routes
   |
   v

4. routes/user.routes.js
   - Matches URL & HTTP method
   - Calls controller
   |
   v

5. controllers/user.controller.js
   - Validates input
   - Executes business logic
   - Calls model
   |
   v

6. models/user.model.js
   - Interacts with MongoDB
   |
   v

7. MongoDB
   - Fetches data
   - Returns result
   |
   v

8. Controller
   - Formats response
   |
   v

9. Client receives JSON response
```

---

## 3. Project Folder Structure

```
src/
 ├── server.js
 ├── app.js
 ├── routes/
 │    └── user.routes.js
 ├── controllers/
 │    └── user.controller.js
 └── models/
      └── user.model.js
```

---

## 4. Important Files Explained

### 4.1 `server.js`

**Purpose:**

* Entry point of the application
* Connects to MongoDB
* Starts HTTP server

**Why it is important:**

* App will not run without this file
* Controls server startup lifecycle

**Key Responsibilities:**

* Load environment variables.  [ like : ENV files ]
* Connect database
* Start listening on a port

---

### 4.2 `app.js`

**Purpose:**

* Initializes Express app
* Registers global middlewares
* Mounts routes

**Why it is important:**

* Keeps server clean and modular
* Separates app configuration from startup logic

**Key Responsibilities:**

* `express.json()`
* Route registration
* Health check endpoint

---

### 4.3 `routes/user.routes.js`

**Purpose:**

* Defines API endpoints

**Why it is important:**

* Keeps routing logic separate
* Makes APIs easy to manage

**Example Responsibilities:**

* Map URL → controller function

---

### 4.4 `controllers/user.controller.js`

**Purpose:**

* Handles request & response logic      [ here all the api logic developer write ]

**Why it is important:**

* Core business logic lives here
* Easy to test and maintain

**Responsibilities:**

* Validate inputs
* Call database layer
* Handle success & error responses

---

### 4.5 `models/user.model.js`     [ it generally database table in simple terms ] 

**Purpose:**

* Defines database schema
* Interacts with MongoDB

**Why it is important:**

* Single source of truth for data shape
* Prevents invalid data

**Responsibilities:**

* Schema definition
* Data validation
* Database queries

---

### 4.6 `middlewares/auth.middleware.js`

**Purpose:**

* Protects private APIs

**Why it is important:**

* Ensures only authorized users access data
* Security layer

**Responsibilities:**

* Verify JWT
* Attach user to request object

---

### 4.7 `middlewares/error.middleware.js`

**Purpose:**

* Centralized error handling

**Why it is important:**

* Prevents app crash
* Standard error responses

---

## 5. Request Lifecycle Diagram (With Middleware)

```
Request
  |
  v
Express Middleware
  |
  v
Auth Middleware (optional)
  |
  v
Route Handler
  |
  v
Controller
  |
  v
Model (DB)
  |
  v
Controller
  |
  v
Response
```

---

## 6. Why This Architecture Matters

* ✅ Scalable
* ✅ Easy to debug
* ✅ Clean separation of concerns
* ✅ Frontend-friendly APIs
* ✅ Production-ready

---

## 7. Common Mistakes to Avoid

* Putting DB logic in routes
* Returning passwords in API response
* No error handling
* No input validation
* Mixing login & register logic

---

## 8. How Frontend (React Native) Connects

```
Axios → API Route → Controller → DB → Response
```

Best practice:

* Store token securely
* Use Axios interceptor
* Handle 401 globally

---

## 9. Summary

* `server.js` → starts everything
* `app.js` → configures Express
* `routes` → defines APIs
* `controllers` → business logic
* `models` → database layer
* `middlewares` → security & stability

This structure is **industry-standard** and suitable for **mobile applications**.

