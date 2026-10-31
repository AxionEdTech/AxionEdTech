// Plain-language auth errors and the "already registered" check.
import test from "node:test";
import assert from "node:assert/strict";
import { friendlyAuthError, isAlreadyRegistered } from "../src/authMessages.js";

test("unconfirmed email (by code or by message)", () => {
  assert.equal(friendlyAuthError({ code: "email_not_confirmed", message: "x" }).code, "email_not_confirmed");
  assert.equal(friendlyAuthError({ message: "Email not confirmed" }).code, "email_not_confirmed");
  assert.match(friendlyAuthError({ message: "Email not confirmed" }).message, /confirm your email first/);
});
test("email rate limits, in both wordings Supabase uses", () => {
  assert.equal(friendlyAuthError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }).code, "rate_limited");
  assert.equal(friendlyAuthError({ message: "For security purposes, you can only request this after 52 seconds." }).code, "rate_limited");
});
test("wrong password is explained without technical wording", () => {
  const f = friendlyAuthError({ message: "Invalid login credentials" });
  assert.equal(f.code, "invalid_credentials");
  assert.match(f.message, /don't match/);
});
test("already registered (error form)", () => {
  assert.equal(friendlyAuthError({ message: "User already registered" }).code, "already_registered");
});
test("unknown errors keep their message; empty ones get a fallback", () => {
  assert.equal(friendlyAuthError({ message: "Password should be at least 8 characters." }).message, "Password should be at least 8 characters.");
  assert.match(friendlyAuthError({}).message, /Something went wrong/);
  assert.match(friendlyAuthError(null).message, /Something went wrong/);
});
test("isAlreadyRegistered: empty identities means the email already has an account", () => {
  assert.equal(isAlreadyRegistered({ identities: [] }), true);
  assert.equal(isAlreadyRegistered({ identities: [{ id: "1" }] }), false);
  assert.equal(isAlreadyRegistered({}), false);          // no identities info -> don't guess
  assert.equal(isAlreadyRegistered(null), false);
});
