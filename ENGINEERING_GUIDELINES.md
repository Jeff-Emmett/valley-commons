# Engineering Guidelines

## Git & Version Control

### Never Force Commit
**CRITICAL RULE:** Never use `git add -f` or `git commit --force` to commit files that are intentionally ignored by `.gitignore`.

**Rationale:**
- Files in `.gitignore` are ignored for good reasons (security, privacy, internal planning)
- Force committing bypasses these protections
- If a file needs to be tracked, update `.gitignore` instead, don't force it

**What to do instead:**
1. If a file should be tracked: Remove it from `.gitignore` first
2. If a file should remain ignored: Keep it local-only or use a different location
3. If unsure: Ask before committing

**Example of what NOT to do:**
```bash
# ❌ NEVER DO THIS
git add -f refs/some-file.md
git commit -m "Add file"
```

**Example of what TO do:**
```bash
# ✅ DO THIS INSTEAD
# If file should be tracked:
# 1. Edit .gitignore to remove the pattern
# 2. Then commit normally
git add refs/some-file.md
git commit -m "Add file"
```

---

## General Principles

1. **Respect `.gitignore`** - Files are ignored for a reason
2. **Ask before force operations** - Force operations can be destructive
3. **Follow existing patterns** - Maintain consistency with project structure
4. **Security first** - Never commit secrets, API keys, or sensitive data

---

**Last Updated:** January 2025

