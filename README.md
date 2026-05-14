# B Bhanja Poultry Supply Website

Run the site through the Node server so the admin page is protected.

```powershell
npm start
```

Open:

- Public website: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin`

On first start, the server prints a temporary admin password in the terminal. Login with username `admin`, then change the username/password from **Admin > Security**.

Content and hashed admin credentials are stored in `data/database.json`. Passwords are stored with PBKDF2 hashes, not plain text.

## Deploying

Deploy this as a Node.js web service, not as a static site.

Recommended settings:

- Build command: leave blank, or use `npm install`
- Start command: `npm start`
- Public URL: open `/`
- Admin URL: open `/admin`

For production, use a host with persistent storage or replace `data/database.json` with a managed database. If your host deletes local files on restart or redeploy, admin content changes may be lost.
