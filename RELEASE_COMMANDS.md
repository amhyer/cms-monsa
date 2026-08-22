# 🚀 GitHub Release Commands — CMS MONSA v1.0.0

## Option 1: GitHub CLI (Recommended)

### Install GitHub CLI

```bash
# Windows (winget)
winget install GitHub.cli

# macOS (brew)
brew install gh

# Linux (apt)
sudo apt install gh
```

### Login

```bash
gh auth login
```

### Create Release

```bash
# Create release with release notes file
gh release create v1.0.0 \
  --title "CMS MONSA v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md \
  --latest
```

### Create Release with Assets

```bash
# Create release with release notes and attach files
gh release create v1.0.0 \
  --title "CMS MONSA v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md \
  --latest \
  CHANGELOG.md \
  DEPLOYMENT_CHECKLIST.md \
  docker-compose.yml
```

### View Release

```bash
gh release view v1.0.0
```

---

## Option 2: Manual Commands (git + curl)

### Push Commits and Tags

```bash
# Push main branch
git push origin main

# Push v1.0.0 tag
git push origin v1.0.0
```

### Create Release via GitHub API

```bash
# Set variables
OWNER="username"
REPO="cms-monsa"
TAG="v1.0.0"
TITLE="CMS MONSA v1.0.0"
NOTES=$(cat RELEASE_NOTES_v1.0.0.md)

# Create release
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$OWNER/$REPO/releases \
  -d "{
    \"tag_name\": \"$TAG\",
    \"name\": \"$TITLE\",
    \"body\": $(echo "$NOTES" | jq -Rs .),
    \"draft\": false,
    \"prerelease\": false
  }"
```

---

## Option 3: GitHub Web Interface

### Steps

1. **Push commits and tags**
   ```bash
   git push origin main
   git push origin v1.0.0
   ```

2. **Open GitHub releases page**
   ```
   https://github.com/username/cms-monsa/releases/new
   ```

3. **Fill in release form**
   - **Choose a tag**: Select `v1.0.0`
   - **Release title**: `CMS MONSA v1.0.0`
   - **Description**: Paste contents of `RELEASE_NOTES_v1.0.0.md`

4. **Click "Publish release"**

---

## Release Checklist

- [ ] All commits pushed to `main`
- [ ] Tag `v1.0.0` created and pushed
- [ ] Release notes file prepared (`RELEASE_NOTES_v1.0.0.md`)
- [ ] GitHub release created
- [ ] Release assets attached (if any)
- [ ] Release published (not draft)
- [ ] Release verified on GitHub

---

## Quick Commands Summary

```bash
# 1. Push everything
git push origin main && git push origin v1.0.0

# 2. Create release (GitHub CLI)
gh release create v1.0.0 --title "CMS MONSA v1.0.0" --notes-file RELEASE_NOTES_v1.0.0.md

# 3. Verify
gh release view v1.0.0
```

---

*Generated: 22 Agustus 2026*
