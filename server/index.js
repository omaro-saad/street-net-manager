/**
 * Backend entry — run: npm start or npm run dev
 */
import { config } from "./config.js";
import app from "./app.js";

app.listen(config.port, () => {
  console.log(`API running at http://localhost:${config.port}`);
  console.log(`  Health: GET http://localhost:${config.port}/health`);
  console.log(`  Login:  POST http://localhost:${config.port}/api/auth/login (body: { username, password })`);
  console.log(`  Data:   GET/PUT http://localhost:${config.port}/api/data (Bearer token required)`);
});
