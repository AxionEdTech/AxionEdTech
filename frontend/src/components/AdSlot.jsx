import React, { useEffect } from "react";

// Configure VITE_ADSENSE_CLIENT and provide a real slot only after provider approval.
export default function AdSlot({ slot, label = "Advertisement" }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT;
  useEffect(() => {
    if (!client || !slot) return;
    try { window.adsbygoogle = window.adsbygoogle || []; window.adsbygoogle.push({}); }
    catch { /* Ad blockers/local development may block the provider script. */ }
  }, [client, slot]);
  if (!client || !slot) return null;
  return <aside className="ad-slot" aria-label={label}>
    <span className="ad-slot-label">{label}</span>
    <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </aside>;
}
