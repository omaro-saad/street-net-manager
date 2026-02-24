/**
 * Auth — in-memory users. Replace with DB lookup when linking DB.
 */
import { state } from "./store.js";

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

export function getUsers() {
  return safeArray(state.auth?.users);
}

export function findUserByUsername(username) {
  const u = String(username ?? "").trim().toLowerCase();
  const users = getUsers();
  return users.find((x) => String(x?.username ?? "").trim().toLowerCase() === u) ?? null;
}

export function verifyPassword(user, password) {
  return user.passwordHash === String(password);
}
