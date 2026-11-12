import { useEffect, useState } from "react";
import { api } from "./api.js";
import { sortUpdates } from "./updates.js";

let cache = null;

// Loads the active updates once per visit and shares them between sections
// (Home shows the latest items and the upcoming dates from the same request).
export default function useAnnouncements() {
  const [items, setItems] = useState(cache);

  useEffect(() => {
    if (cache) return undefined;
    let active = true;
    api.listAnnouncements()
      .then((d) => { cache = sortUpdates(d.announcements.filter((a) => a.is_active)); if (active) setItems(cache); })
      .catch(() => { if (active) setItems([]); }); // a marketing section must never block on an error
    return () => { active = false; };
  }, []);

  return items;
}

export function clearAnnouncementsCache() { cache = null; }
