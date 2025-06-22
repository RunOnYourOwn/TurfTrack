Yes, you can absolutely switch back and forth between remotes! In your case, you have:

- `origin` → your Gitea server
- `github` → your GitHub repository

### How to Push to Both Remotes

You can push to either or both remotes at any time:

```bash
# Push main branch to Gitea
git push origin main

# Push main branch to GitHub
git push github main

# Push all branches to both
git push origin --all
git push github --all

# Push all tags to both
git push origin --tags
git push github --tags
```

### How to Pull from Both Remotes

By default, `git pull` will pull from the currently checked-out branch’s upstream (usually `origin`).  
To pull from a specific remote:

```bash
git pull origin main
git pull github main
```

### Keeping Both Remotes in Sync

- **Best practice:** Always push your changes to both remotes after you commit.
- If you work with collaborators, make sure everyone pushes/pulls from both, or designate one as the “source of truth.”
- If you ever get out of sync (e.g., a commit is on Gitea but not GitHub), just pull from the remote that has the commit, then push to the other.

### Example Workflow

1. Make changes, commit locally.
2. Push to both remotes:
   ```bash
   git push origin main
   git push github main
   ```
3. If you create a new branch:
   ```bash
   git push origin my-feature
   git push github my-feature
   ```

### Setting Upstream for New Branches

When you create a new branch, you can set the upstream for both remotes:

```bash
git push -u origin my-feature
git push -u github my-feature
```

### Summary

- You can use as many remotes as you want.
- Push/pull to each as needed.
- To keep them in sync, always push/pull to both after making changes.

Let me know if you want a script or alias to automate pushing to both!
