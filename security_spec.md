# Security Specification for Mãe.

## Data Invariants
- All data must belong to a specific user.
- A user can only read and write their own data.
- Pregnancy settings (dueDate) must be a valid date.
- Timestamps like `createdAt` (if added) must be server-validated.
- IDs must be alphanumeric and of reasonable size.

## The Dirty Dozen Payloads
1. **Identity Theft**: Try to create a symptom with a different `userId` in the path than the authenticated user.
2. **Settings Poisoning**: Try to set a 1MB string as `dueDate`.
3. **Privilege Escalation**: Try to update `pregnancy` settings of another user.
4. **Invalid Intensity**: Set symptom intensity to "ultra-high" (not in enum).
5. **Negative Weight**: Log a weight of -50kg.
6. **Negative Price**: Log a shopping item with price -100.
7. **Future Date Appointment**: (Optional validation) Create appointment in the year 3000.
8. **Spam Checklist**: Create 1000 checklist items (size check).
9. **Malicious ID**: Use an ID like `../../../etc/passwd`.
10. **Shadow Field**: Add `isServerAdmin: true` to a user document.
11. **Type Mismatch**: Send a string for a `price` field which should be a number.
12. **Bypass Verification**: Write as a user with `email_verified: false`.

## Test Runner (Logic)
The `firestore.rules` must reject all the above.
