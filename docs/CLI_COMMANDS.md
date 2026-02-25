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

---

## GitHub CLI (gh) — Publishing

Requires [GitHub CLI](https://cli.github.com/) installed and logged in (`gh auth login`). Run from **project root**.

### Trigger deploy to GitHub Pages

Run the "Deploy to GitHub Pages" workflow manually (same as **Actions** → **Deploy to GitHub Pages** → **Run workflow**):

```bash
gh workflow run "Deploy to GitHub Pages"
```

Check run status:

```bash
gh run list --workflow="Deploy to GitHub Pages" --limit 5
gh run watch
```

### Create and publish a release (tag + notes)

Create a new tag, push it, and open a release in the browser to add notes and publish:

```bash
# Create tag (e.g. v3.1.0) and push
git tag v3.1.0
git push origin v3.1.0

# Create a draft release for that tag (opens in browser to add notes and publish)
gh release create v3.1.0 --draft
```

Or create a release from the CLI with title and notes:

```bash
gh release create v3.1.0 --title "v3.1.0" --notes "Release notes here."
```

### Publish a release with build artifacts (e.g. Windows installer)

Build the app, then create a release and upload the built files:

```bash
npm run build && npm run dist
gh release create v3.1.0 dist/*.exe --title "v3.1.0" --notes "Release notes."
```

To upload to an existing release:

```bash
gh release upload v3.1.0 dist/*.exe
```
