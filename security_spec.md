# Security Specification & Payload-First TDD (`firestore.rules`)

## 1. Data Invariants & Relationship Mapping
1. **Single Owner-Admin Authority**: Only the verified owner (`request.auth.token.email == 'mihal4ik11@gmail.com' && request.auth.token.email_verified == true`, or a document in console-managed `admins/{uid}`) may create, update, delete, or list draft/unlisted records.
2. **Zero PII Exposure**: No visitor email, phone, or private account data is stored in publicly readable collections. `cases`, `case_media`, `case_workflows`, and `portfolio_settings/main` contain only portfolio showcase content.
3. **Strict Visibility Isolation**:
   - `cases`: Public `list` queries are strictly restricted to `resource.data.status == 'published'` (prevents scraping `draft` or NDA `unlisted` cases). Public `get` allows `published` or `unlisted` (for direct NDA share links); `draft` is strictly admin-only.
   - `case_media` & `case_workflows`: Public `list` is forbidden (`allow list: if isAdmin()`). Public `get` is permitted only when `resource.data.visibility in ['published', 'unlisted']`.
4. **Atomic Parent-Child Integrity**: Creating a `case_media/{mediaId}` or `case_workflows/{workflowId}` document requires `existsAfter(/databases/$(database)/documents/cases/$(incoming().caseId))` so orphaned assets cannot be created without a valid parent case.
5. **Immutability & Temporal Integrity**:
   - `id`, `ownerId`, `caseId`, and `createdAt` cannot be modified after creation.
   - `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
6. **Volumetric & Regex Guarding**:
   - All path IDs validated with `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars).
   - Every string field has explicit `.size()` bounds; every array has explicit `.size()` bounds and element type guard.
   - All writes enforce strict key allowlists (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Shadow Field Injection (Cases)**: Admin sends valid case payload + extra `"isAdmin": true` ghost field → rejected by `hasOnly(...)`.
2. **Unverified Admin Email Spoofing**: Caller with `email: 'mihal4ik11@gmail.com'` and `email_verified: false` attempts to write to `cases` → rejected by `request.auth.token.email_verified == true`.
3. **Non-Admin Case Creation**: Authenticated non-owner (`attacker@example.com`, verified) attempts to create a case → rejected by `isAdmin()`.
4. **Draft Case Exfiltration (`get`)**: Anonymous visitor attempts `get` on `cases/secret-draft` where `status == 'draft'` → rejected.
5. **NDA / Draft Scraping (`list`)**: Anonymous visitor attempts `list` on `cases` without `where('status', '==', 'published')` → rejected by rule-side `resource.data.status == 'published'`.
6. **Owner UID Spoofing**: Admin attempts to create a case with `ownerId: 'other-uid'` != `request.auth.uid` → rejected by identity integrity check.
7. **Immutable Field Tampering (`createdAt` / `ownerId`)**: Admin attempts to update `createdAt` or `ownerId` on an existing case → rejected by `affectedKeys().hasOnly(...)` + immutability check.
8. **Client-Forged Timestamp**: Admin sends a manual `createdAt` / `updatedAt` timestamp instead of `serverTimestamp()` (`request.time`) → rejected by temporal integrity check.
9. **Path ID Poisoning**: Caller attempts to create a case with a 200-char ID or invalid chars (`../evil`) → rejected by `isValidId()`.
10. **Orphaned Media Upload**: Admin attempts to create `case_media/m1` pointing to a non-existent `caseId: 'ghost-case'` → rejected by `existsAfter(...)`.
11. **Media Payload Bloat / Non-Image Injection**: Admin attempts to store `<script>alert(1)</script>` or >650KB string in `case_media.dataUrl` → rejected by `matches('^data:image/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$')` and `.size() <= 650000`.
12. **Self-Assigned Admin Escalation**: Authenticated user attempts to create `/admins/{theirUid}` → rejected by default-deny (`allow read, write: if false`).
