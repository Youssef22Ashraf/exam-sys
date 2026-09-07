# Clean build

```bash
rm -rf backend/node_modules backend/dist frontend/node_modules frontend/dist
cd backend && npm install && npx prisma generate && npm run build
cd ../frontend && npm install && npm run build
```

Then `docker build -t exam-sys .` to prove the production image builds. Do not delete `backend/prisma/dev.db` or `backend/uploads/` unless the user asks — they hold data.
