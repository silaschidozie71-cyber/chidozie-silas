# Security Specification — Hollow Eve: The Midnight Express

## 1. Data Invariants
1. **Owner-Only Profile Isolation**: A document at `/users/{userId}` can only be read, created, or updated by `request.auth.uid == userId` with a verified email (`request.auth.token.email_verified == true`), and contains no PII (no email/phone/address).
2. **Leaderboard Attribution & Integrity**: A document at `/leaderboard/{entryId}` must have `uid == request.auth.uid`, valid `mapId` enum, bounded `score` (`0..500000`), bounded `timeSeconds` (`5..86400`), server timestamp `createdAt == request.time`, and cannot be updated once created.
3. **Custom Map Ownership & Size Guards**: A document at `/customMaps/{mapId}` must have `ownerId == request.auth.uid`, `gridRows.size() == 16`, bounded string lengths, and immutable `ownerId` and `createdAt` on updates.
4. **Path ID Hardening**: Every single-document `get`, `create`, `update`, `delete` validates `isValidId(docId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. Dirty Dozen Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read of `/users/victim123` -> DENIED.
2. Authenticated User A reading `/users/userB` -> DENIED (owner-only profile isolation).
3. Creating `/users/userA` with `uid: "userB"` (UID spoofing) -> DENIED.
4. Updating `/users/userA` with an extra shadow field `{ isAdmin: true }` -> DENIED (`hasOnly` / schema gate).
5. Creating `/users/userA` with negative `candyCoins: -500` or excessive `points: 999999999` -> DENIED.
6. Updating `/users/userA` while modifying immutable `createdAt` -> DENIED.
7. Submitting `/leaderboard/entry1` with `uid: "otherUser"` -> DENIED.
8. Submitting `/leaderboard/entry1` with `score: 9999999` or client-forged `createdAt` -> DENIED.
9. Updating an existing `/leaderboard/entry1` to inflate `score` -> DENIED (immutable).
10. Creating `/customMaps/badMap` with `gridRows.size() == 1000` (Denial of Wallet array poisoning) -> DENIED.
11. Updating `/customMaps/map1` by User B who is not `ownerId` -> DENIED.
12. Creating `/users/userA` with `email_verified == false` -> DENIED.
