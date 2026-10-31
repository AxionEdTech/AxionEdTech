// Plain-language versions of Supabase Auth's error messages, plus the check
// for "this email is already registered" (which Supabase deliberately reports
// as a *successful* sign-up with no identities, so nobody can use the form to
// find out who has an account).

export function friendlyAuthError(error) {
  const msg = String(error?.message || "");
  const code = error?.code || "";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return { code: "email_not_confirmed", message: "Please confirm your email first. We sent you a confirmation link when you registered." };
  }
  if (code === "over_email_send_rate_limit" || /rate limit|too many requests|you can only request this after/i.test(msg)) {
    return { code: "rate_limited", message: "Too many emails were requested in a short time. Please wait a few minutes and try again." };
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return { code: "invalid_credentials", message: "That email and password don't match. Please check them and try again." };
  }
  if (code === "user_already_exists" || /already (?:been )?registered/i.test(msg)) {
    return { code: "already_registered", message: "This email is already registered. Please log in instead." };
  }
  return { code, message: msg || "Something went wrong. Please try again." };
}

// signUp() for an email that already has an account returns a user whose
// identities list is empty, and no email is sent.
export function isAlreadyRegistered(user) {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
