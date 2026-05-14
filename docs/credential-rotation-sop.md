# Carbon SSH — Credential Rotation SOP for Users

> **When to use:** After a confirmed or suspected security incident involving Carbon SSH.
> **Time required:** ~30 minutes

## Step 1: Update Carbon Immediately

1. Open Carbon SSH
2. If an update is available, install it
3. If you can't update, download the latest version from [official site]

## Step 2: Rotate SSH Keys

### Generate a new key pair

```bash
# ED25519 (recommended)
ssh-keygen -t ed25519 -C "rotation-$(date +%Y%m%d)" -f ~/.ssh/id_ed25519_new

# RSA 4096 (fallback for older servers)
ssh-keygen -t rsa -b 4096 -C "rotation-$(date +%Y%m%d)" -f ~/.ssh/id_rsa_new
```

**IMPORTANT:** Set a strong, unique passphrase when prompted.

### Deploy the new key to your servers

For each server you connect to with Carbon:

```bash
# Copy new public key to server
ssh-copy-id -i ~/.ssh/id_ed25519_new user@server.example.com

# Verify new key works
ssh -i ~/.ssh/id_ed25519_new user@server.example.com "echo 'New key works'"
```

### Remove the old key from each server

```bash
ssh user@server.example.com
# Edit authorized_keys and remove the old key's line
vi ~/.ssh/authorized_keys
# Or remove by comment:
sed -i '/old-key-comment/d' ~/.ssh/authorized_keys
```

### Securely delete the old key

```bash
# After confirming all servers accept the new key
shred -u ~/.ssh/id_ed25519
shred -u ~/.ssh/id_ed25519.pub
```

### Update Carbon with the new key

1. Open Carbon → Sidebar → Click the connection
2. Switch auth method to "Private Key"
3. Paste your new private key (or browse to select)
4. Enter the passphrase if you set one
5. Save

## Step 3: Rotate SSH Passwords

For servers where you use password authentication:

1. SSH into the server using the new key (or existing credentials)
2. Run: `passwd`
3. Enter a new strong password
4. Update the password in Carbon → Connection settings

## Step 4: Rotate AI API Keys

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy it immediately (won't be shown again)
4. Revoke the old key
5. Update in Carbon → Settings → AI

### Anthropic
1. Go to https://console.anthropic.com/settings/keys
2. Create new key → Copy → Revoke old
3. Update in Carbon → Settings → AI

### Other Providers
Repeat the create → copy → revoke → update-in-Carbon flow for each provider.

## Step 5: Rotate App Lock Credentials

1. Open Carbon → Settings → Security
2. Change your app lock password
3. If using biometrics, re-register your fingerprint/passkey

## Step 6: Audit Your Servers (Using Security Guard)

Run Carbon's Security Guard feature to check for unauthorized access:

1. Connect to each server
2. Run Security Guard scan
3. Review the report for:
   - Unknown SSH keys in authorized_keys
   - Unauthorized user accounts
   - Suspicious login timestamps
   - Unexpected cron jobs or services

## Step 7: Monitor

For the next 2 weeks:

1. Review auth logs daily: `grep "Accepted" /var/log/auth.log | tail -50`
2. Watch for connections from unknown IPs
3. Monitor for unexpected outbound connections

---

## Quick Commands Reference

```bash
# Check recent SSH logins
last -20

# Check auth log for suspicious activity
grep "Failed password" /var/log/auth.log | tail -20

# Check current SSH sessions
who

# List all users with shell access
getent passwd | grep -E "/bin/(ba|z)?sh$"

# Check for unauthorized cron jobs
for u in $(cut -f1 -d: /etc/passwd); do echo "=== $u ==="; crontab -u "$u" -l 2>/dev/null; done
```

---

## Need Help?

Contact: security@carbon.app
