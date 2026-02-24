# CLI commands

Run from **project root** unless noted.

---

## Create new user (organization + Oadmin, optional multiple Ousers)

**Required (Oadmin only):**
```bash
npm run create-user -- <OadminUsername> <OadminPassword> <secretCode> <plan> <duration>
```

**With one or more Ousers (each Ouser = 3 args: username, password, secretCode):**
```bash
npm run create-user -- <OadminUsername> <OadminPassword> <secretCode> <plan> <duration> <OuserUser1> <OuserPass1> <OuserCode1> [<OuserUser2> <OuserPass2> <OuserCode2> ...]
```

- **Oadmin:** username, password, secretCode (6 digits) are required.
- **plan:** `basic` | `plus` | `pro`
- **duration:** `monthly` (30 days) | `3months` (90 days) | `yearly` (365 days) | **number** = exact days | **0** = plan finished (user cannot login until support renews)

**Examples:**
```bash
npm run create-user -- admin mypass 123456 basic yearly
npm run create-user -- admin mypass 123456 basic 30
npm run create-user -- admin mypass 123456 pro yearly emp1 emppass1 654321 emp2 emppass2 111222
npm run create-user -- admin mypass 123456 basic 0
```

---

## Extend subscription (Oadmin + secret code + new duration)

Add time to an existing Oadmin subscription:

```bash
npm run extend-subscription -- <OadminUsername> <secretCode> <newDuration>
```

- **secretCode:** 6-digit secret code for that Oadmin.
- **newDuration:** `monthly` (30 days) | `3months` (90 days) | `yearly` (365 days) | or a number = days (e.g. `30`, `90`).

**Example:**
```bash
npm run extend-subscription -- admin 123456 yearly
```

---

## Cancel plan (set subscription to expired)

User data is kept; user cannot login until support renews:

```bash
npm run cancel-plan -- <OadminUsername> <secretCode>
```

---

## Renew subscription (replace plan; warns if current plan is active)

Set new plan and duration. If a live plan is running, you will be prompted to confirm replacement:

```bash
npm run renew-subscription -- <OadminUsername> <secretCode> <plan> <duration>
```

- **plan:** `basic` | `plus` | `pro`
- **duration:** `monthly` (30) | `3months` (90) | `yearly` (365) | or number of days

**Example:**
```bash
npm run renew-subscription -- admin 123456 pro yearly
```

---

## Free up DB (delete all users and data)

Removes all rows from: accounts, account_permissions, organizations, subscriptions, org_addons, org_users, employee_permissions, lines. Keeps schema and `plan_limits`.

**Command (prompts for confirmation):**
```bash
npm run reset-db
```

From `server/`:
```bash
npm run reset-db
```

You will be asked: `Delete ALL users, organizations, subscriptions, lines and permissions? (y/n):` — type `y` or `yes` to proceed.
