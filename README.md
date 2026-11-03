# e-Kigega — Stock Inventory Management API

A small Express + MongoDB (Mongoose) REST API for managing users and stock products.

- **Stack:** Node.js, Express 5, MongoDB, Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, `cors`, `dotenv`
- **Base URL:** `http://localhost:5000`
- **Auth:** Bearer JWT (valid for 2 hours)
- **Roles:** `superadmin` → `admin` → `storekeeper` → `staff`

---

## Table of contents

1. [Project structure](#project-structure)
2. [Setup](#setup)
3. [Roles and permissions](#roles-and-permissions)
4. [Endpoint summary](#endpoint-summary)
5. [Testing the API](#testing-the-api)
   - [0. Health check](#0-health-check)
   - [1. Log in and get a token](#1-log-in-and-get-a-token)
   - [2. Create users (role chain)](#2-create-users-role-chain)
   - [3. User routes](#3-user-routes)
   - [4. Product routes](#4-product-routes)
6. [Negative test checklist](#negative-test-checklist)
7. [Postman / Thunder Client testing](#postman--thunder-client-testing)
8. [Error responses](#error-responses)
9. [Known quirks and caveats](#known-quirks-and-caveats)

---

## Project structure

```
e-kigega-v2.0/
├── server.js              # App entry point, route mounting, Mongo connection
├── seed.js                # Creates the first Super Admin from .env
├── middleware/
│   └── auth.js            # protect (JWT check) + superAdminOnly
├── models/
│   ├── User.js            # name, email, password (hashed), role
│   └── Product.js         # name, sku, category, quantity, price
├── routes/
│   ├── authRoutes.js      # POST /login
│   ├── userRoutes.js      # user CRUD + role-based account creation
│   └── productRoutes.js   # product CRUD
├── package.json
└── .env
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the `.env` file

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/stock_inventory
JWT_SECRET=replace_this_with_a_long_random_secret
SUPERADMIN_NAME=System Owner
SUPERADMIN_EMAIL=owner@example.com
SUPERADMIN_PASSWORD=a-password-of-at-least-12-chars
```

> `SUPERADMIN_PASSWORD` must be **at least 12 characters** or `seed.js` will refuse to create the account.

### 3. Make sure MongoDB is running

Local install: `mongodb://127.0.0.1:27017/stock_inventory`
Atlas or Docker: put your own connection string in `MONGO_URI`.

### 4. Create the Super Admin

```bash
node seed.js
```

Expected output: `Super Admin created successfully!`
Running it twice is safe — it reports `This email already exists. No account created.`

### 5. Start the server

```bash
npm run dev     # nodemon, auto-restart
# or
npm start       # plain node
```

Expected:

```
MongoDB connected successfully
Server running on port 5000
```

### 6. Quick smoke test

```bash
curl http://localhost:5000/
# Stock Inventory Management API is running!
```

---

## Roles and permissions

| Action | superadmin | admin | storekeeper | staff |
| --- | :---: | :---: | :---: | :---: |
| Create `admin` (`POST /api/users/admins`) | ✅ | ❌ | ❌ | ❌ |
| Create `storekeeper` (`POST /api/users/storekeepers`) | ❌ | ✅ | ❌ | ❌ |
| Create `staff` (`POST /api/users/staff`) | ❌ | ❌ | ✅ | ❌ |
| List / read users | ✅ | ✅ | ✅ | ✅ |
| Update / delete users | ✅ | ✅ | ✅ | ✅ ⚠️ |
| Create product | ✅ | ✅ | ✅ | ❌ |
| Read / update / delete products | ✅ | ✅ | ✅ | ✅ ⚠️ |

> ⚠️ Update and delete routes only require a valid login — they do **not** check the role. See [Known quirks](#known-quirks-and-caveats).

**Bootstrapping the chain:** only the Super Admin exists after seeding. So:

1. Super Admin logs in → creates an **admin**
2. Admin logs in → creates a **storekeeper**
3. Storekeeper logs in → creates **staff**

---

## Endpoint summary

| # | Method | Route | Auth | Allowed roles | Purpose |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET` | `/` | No | — | Health check |
| 2 | `POST` | `/api/auth/login` | No | — | Log in, returns JWT |
| 3 | `POST` | `/api/users/admins` | Bearer | superadmin | Create an admin |
| 4 | `POST` | `/api/users/storekeepers` | Bearer | admin | Create a storekeeper |
| 5 | `POST` | `/api/users/staff` | Bearer | storekeeper | Create staff |
| 6 | `GET` | `/api/users` | Bearer | any logged-in | List all users |
| 7 | `GET` | `/api/users/:id` | Bearer | any logged-in | Get one user |
| 8 | `PUT` | `/api/users/:id` | Bearer | any logged-in | Update a user |
| 9 | `DELETE` | `/api/users/:id` | Bearer | any logged-in | Delete a user |
| 10 | `POST` | `/api/products` | Bearer | superadmin, admin, storekeeper | Add a product |
| 11 | `GET` | `/api/products` | Bearer | any logged-in | List all products |
| 12 | `GET` | `/api/products/:id` | Bearer | any logged-in | Get one product |
| 13 | `PUT` | `/api/products/:id` | Bearer | any logged-in | Update product / stock |
| 14 | `DELETE` | `/api/products/:id` | Bearer | any logged-in | Delete a product |

### Request bodies

**Login** — `POST /api/auth/login`

```json
{ "email": "owner@example.com", "password": "a-password-of-at-least-12-chars" }
```

**Create account** — `POST /api/users/admins|storekeepers|staff`

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "min8chars" }
```

`role` is assigned by the route — you cannot send it.

**Create product** — `POST /api/products`

```json
{
  "name": "Cement 50kg",
  "sku": "CEM-50",
  "category": "Building Materials",
  "quantity": 120,
  "price": 12500
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `name` | String | required, trimmed |
| `sku` | String | required, **unique** (duplicate → `409`) |
| `category` | String | required |
| `quantity` | Number | required, `>= 0` |
| `price` | Number | required, `>= 0` |

---

## Testing the API

All examples assume the server is on `http://localhost:5000` and MongoDB is running.

**Windows users:** the `curl` examples below work as-is in **PowerShell 7+** and **Git Bash**. In PowerShell 5.1 `curl` is an alias for `Invoke-WebRequest`; use the PowerShell examples instead, or call `curl.exe`.

### 0. Health check

```bash
curl http://localhost:5000/
```

```powershell
Invoke-RestMethod http://localhost:5000/
```

**Expected:** `200` — `Stock Inventory Management API is running!`

### 1. Log in and get a token

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"a-password-of-at-least-12-chars"}'
```

```powershell
$login = Invoke-RestMethod -Method Post http://localhost:5000/api/auth/login `
  -ContentType "application/json" `
  -Body (@{ email = "owner@example.com"; password = "a-password-of-at-least-12-chars" } | ConvertTo-Json)

$saToken = $login.token
$login.user
```

**Expected:** `200`

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOi...",
  "user": { "id": "6512...", "name": "System Owner", "email": "owner@example.com", "role": "superadmin" }
}
```

Save the token. Every route below needs it:

```
Authorization: Bearer <token>
```

In PowerShell, build the header once per role:

```powershell
$superAdminHeaders = @{ Authorization = "Bearer $saToken" }
```

### 2. Create users (role chain)

Each step must be performed **with the token of the role above it.**

**a) Super Admin creates an Admin**

```bash
curl -X POST http://localhost:5000/api/users/admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{"name":"Ada Admin","email":"admin@example.com","password":"password123"}'
```

```powershell
$admin = Invoke-RestMethod -Method Post http://localhost:5000/api/users/admins `
  -Headers $superAdminHeaders `
  -ContentType "application/json" `
  -Body (@{ name = "Ada Admin"; email = "admin@example.com"; password = "password123" } | ConvertTo-Json)
$admin
```

**Expected:** `201` — `"admin created successfully"` plus the created user (no password returned).

**b) Admin creates a Store Keeper**

```bash
# log in as the admin first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

```bash
curl -X POST http://localhost:5000/api/users/storekeepers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Sam Store","email":"store@example.com","password":"password123"}'
```

**Expected:** `201` — `"storekeeper created successfully"`

**c) Store Keeper creates staff**

```bash
curl -X POST http://localhost:5000/api/users/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STOREKEEPER_TOKEN" \
  -d '{"name":"Stan Staff","email":"staff@example.com","password":"password123"}'
```

**Expected:** `201` — `"staff created successfully"`

> Using the wrong role (e.g. Super Admin calling `/storekeepers`) returns `403`.

### 3. User routes

**List all users**

```bash
curl http://localhost:5000/api/users -H "Authorization: Bearer $TOKEN"
```

```powershell
Invoke-RestMethod http://localhost:5000/api/users -Headers $headers | Format-Table name, email, role
```

**Expected:** `200` — JSON array of users.

**Get one user**

```bash
curl http://localhost:5000/api/users/<USER_ID> -H "Authorization: Bearer $TOKEN"
```

**Expected:** `200` — user object. Bad id → `400 Invalid user ID`; unknown id → `404 User not found`.

**Update a user**

```bash
curl -X PUT http://localhost:5000/api/users/<USER_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Ada A. Admin","role":"storekeeper"}'
```

**Expected:** `200` — updated user object.

> Sending `password` here stores it **unhashed**, which breaks login for that user. Create users through the `/admins`, `/storekeepers`, `/staff` routes instead.

**Delete a user**

```bash
curl -X DELETE http://localhost:5000/api/users/<USER_ID> -H "Authorization: Bearer $TOKEN"
```

**Expected:** `200` — `{"message":"User deleted successfully"}`

### 4. Product routes

Use the **storekeeper**, **admin**, or **superadmin** token for creation. `staff` gets `403`.

**Create a product**

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STOREKEEPER_TOKEN" \
  -d '{"name":"Cement 50kg","sku":"CEM-50","category":"Building Materials","quantity":120,"price":12500}'
```

```powershell
$product = Invoke-RestMethod -Method Post http://localhost:5000/api/products `
  -Headers $storekeeperHeaders `
  -ContentType "application/json" `
  -Body (@{
    name     = "Cement 50kg"
    sku      = "CEM-50"
    category = "Building Materials"
    quantity = 120
    price    = 12500
  } | ConvertTo-Json)
$product
```

**Expected:** `201`

```json
{
  "message": "Product added successfully",
  "product": {
    "_id": "6512...",
    "name": "Cement 50kg",
    "sku": "CEM-50",
    "category": "Building Materials",
    "quantity": 120,
    "price": 12500,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Reusing the same `sku` → `409 {"message":"This SKU already exists"}`.

**List products**

```bash
curl http://localhost:5000/api/products -H "Authorization: Bearer $TOKEN"
```

**Get one product**

```bash
curl http://localhost:5000/api/products/<PRODUCT_ID> -H "Authorization: Bearer $TOKEN"
```

**Update a product / restock**

```bash
curl -X PUT http://localhost:5000/api/products/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"quantity":200,"price":13000}'
```

**Expected:** `200` — updated product. `quantity: -1` → `400` validation error.

**Delete a product**

```bash
curl -X DELETE http://localhost:5000/api/products/<PRODUCT_ID> -H "Authorization: Bearer $TOKEN"
```

**Expected:** `200` — `{"message":"Product deleted successfully"}`

---

## Negative test checklist

Run these once to confirm the guards work:

| Test | Request | Expected |
| --- | --- | --- |
| Missing token | `GET /api/products` with no header | `401 Please log in first` |
| Malformed header | `Authorization: Token abc` | `401 Please log in first` |
| Bad/expired token | `Authorization: Bearer garbage` | `401 Invalid or expired token` |
| Token of deleted user | log in, delete that user, reuse token | `401 User no longer exists` |
| Wrong create-role | Super Admin → `POST /api/users/storekeepers` | `403 Only Admin can create Store Keepers` |
| Staff adds product | staff token → `POST /api/products` | `403 You are not allowed to add products` |
| Missing login fields | `POST /api/auth/login` with `{}` | `400 Email and password are required` |
| Wrong password | login with bad password | `401 Invalid email or password` |
| Duplicate email | create the same email twice | `409 Email already exists` |
| Short password | create user with `"pass"` | `400 Password must be at least 8 characters` |
| Duplicate SKU | create product with an existing sku | `409 This SKU already exists` |
| Incomplete product | `POST /api/products` missing `price` | `400 Please provide all product details` |
| Invalid id | `GET /api/users/abc` | `400 Invalid user ID` |
| Missing record | `GET /api/products/<valid-but-absent-id>` | `404 Product not found` |

---

## Postman / Thunder Client testing

1. Create an environment with `baseUrl = http://localhost:5000`.
2. Create a collection folder **Auth** with `POST {{baseUrl}}/api/auth/login`.
3. In that request's **Tests** tab (Postman), auto-save the token:

```js
const body = pm.response.json();
pm.environment.set("token", body.token);
```

4. On the collection, set **Authorization → Bearer Token → `{{token}}`** so every request inherits it.
5. Add folders **Users** and **Products** and create requests matching the table above. Keep separate environments (or variables `saToken`, `adminToken`, `storekeeperToken`, `staffToken`) to test role restrictions.
6. For Thunder Client, use the **Env** tab for `baseUrl`/`token` and **Auth → Bearer** per request.

A minimum happy-path collection: health → login (superadmin) → create admin → login (admin) → create storekeeper → login (storekeeper) → create staff → create product → list products → update product → delete product.

---

## Error responses

| Status | When |
| --- | --- |
| `200` | Successful read/update/delete/login |
| `201` | User or product created |
| `400` | Missing/invalid fields, invalid ObjectId, Mongoose validation |
| `401` | No token, invalid/expired token, deleted user, bad credentials |
| `403` | Role not allowed for the action |
| `404` | Record not found |
| `409` | Duplicate email or duplicate SKU |
| `500` | Mongo/query failure (login uses `500 Login failed`) |

All errors return JSON in the shape `{ "message": "..." }` (product creation may also include `error`).

---

## Known quirks and caveats

These exist in the current code — useful to know while testing:

1. **Duplicate `POST /api/products` handler.** `routes/productRoutes.js` declares the route twice; Express runs the **first** one (role check + field validation), so the second is dead code.
2. **`/api/users` mounted twice.** `server.js` mounts the router both before and after the health route. Harmless, but redundant.
3. **Route mounting order.** `app.use("/api/auth", ...)` etc. are registered *after* `mongoose.connect(...).then(...)` starts the listener. It works because routes are registered synchronously before the first request, but moving them above the connection block is cleaner.
4. **Update/delete are not role-guarded.** Any logged-in user — including `staff` — can `PUT`/`DELETE` any user or product, and can change `role` via `PUT /api/users/:id`.
5. **Plaintext password on update.** `PUT /api/users/:id` writes `password` as-is (no hashing), so that user can no longer log in.
6. **Unused helper.** `generateSixDigitCode()` in `authRoutes.js` is defined but never used.
7. **Token lifetime** is fixed at 2 hours; there is no refresh endpoint.
8. **No pagination or search** on list endpoints — `GET /api/users` and `GET /api/products` return everything.